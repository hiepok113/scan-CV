import { BadGatewayException, Injectable, InternalServerErrorException } from '@nestjs/common';

export type CandidateAnalysis = { candidateName: string; fileName: string; score: number; jdScore: number; additionalRequirementsScore: number | null; summary: string; strengths: string[]; gaps: string[]; applicationAdvice: string };
type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

@Injectable()
export class AnalysisService {
  async screen(jobFile: Express.Multer.File | undefined, jobDescription: string, cvs: Express.Multer.File[], additionalRequirements: string): Promise<CandidateAnalysis[]> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new InternalServerErrorException('Chưa cấu hình GEMINI_API_KEY trong apps/api/.env.');

    const prompt = `Bạn là chuyên gia tuyển dụng và ATS. Hãy dùng khả năng đọc tài liệu/hình ảnh để xem từng trang PDF, bao gồm bố cục nhiều cột, bảng hoặc bản scan. File sẽ có nhãn ngay trước nội dung.

MÔ TẢ CÔNG VIỆC:\n${jobDescription || '(JD ở trong PDF đính kèm)'}
YÊU CẦU BỔ SUNG CỦA HR:\n${additionalRequirements || '(Không có)'}

QUY TẮC CHẤM BẮT BUỘC: JD là tiêu chí chính và không thể bị thay thế bởi yêu cầu bổ sung. Trước hết chấm jdScore dựa hoàn toàn trên JD. Sau đó mới chấm additionalRequirementsScore dựa hoàn toàn trên yêu cầu bổ sung. Một CV không phù hợp chuyên môn/chức danh/kỹ năng cốt lõi trong JD không được có jdScore cao, dù đáp ứng hoàn hảo yêu cầu bổ sung.

Phải trả duy nhất JSON hợp lệ: {"candidates":[...]}. Mỗi phần tử gồm cvIndex (1 đến ${cvs.length}), jdScore (0-100), additionalRequirementsScore (0-100 hoặc null nếu không có yêu cầu bổ sung), summary (1-2 câu, nêu rõ mức khớp JD trước rồi mới đến yêu cầu bổ sung), strengths (mảng tối đa 3 ý), gaps (mảng tối đa 3 ý), applicationAdvice (1 câu). Không trả trường score; backend tự tính điểm cuối. Trả đúng một phần tử cho mỗi CV, theo bất kỳ thứ tự nào. Chỉ dùng jdScore 0 khi PDF thực sự không có nội dung nhìn thấy được hoặc hoàn toàn không liên quan JD.`;
    const parts: GeminiPart[] = [{ text: prompt }];
    if (jobFile) parts.push({ text: `TỆP JD PDF: ${jobFile.originalname}` }, this.filePart(jobFile));
    cvs.forEach((file, index) => parts.push({ text: `TỆP CV${index + 1} PDF: ${file.originalname}` }, this.filePart(file)));

    try {
      const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } };
        throw Object.assign(new Error(body.error?.message || 'Gemini request failed'), { status: response.status });
      }
      const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini không trả về nội dung.');
      const parsed = JSON.parse(text) as { candidates?: Array<{ cvIndex: number; jdScore: number; additionalRequirementsScore: number | null; summary: string; strengths: string[]; gaps: string[]; applicationAdvice: string }> };
      if (!Array.isArray(parsed.candidates)) throw new SyntaxError('Missing candidates array');
      const seen = new Set<number>();
      const candidates = parsed.candidates.flatMap((item) => {
        const index = Number(item.cvIndex) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= cvs.length || seen.has(index)) return [];
        seen.add(index);
        const file = cvs[index];
        const jdScore = this.scoreInRange(item.jdScore);
        const additionalRequirementsScore = additionalRequirements.trim() ? this.scoreInRange(item.additionalRequirementsScore) : null;
        const score = additionalRequirementsScore === null ? jdScore : Math.round(jdScore * 0.75 + additionalRequirementsScore * 0.25);
        return [{ candidateName: file.originalname.replace(/\.[^.]+$/, ''), fileName: file.originalname, score, jdScore, additionalRequirementsScore, summary: item.summary || '', strengths: Array.isArray(item.strengths) ? item.strengths.slice(0, 3) : [], gaps: Array.isArray(item.gaps) ? item.gaps.slice(0, 3) : [], applicationAdvice: item.applicationAdvice || '' }];
      });
      if (candidates.length !== cvs.length) throw new BadGatewayException('Gemini chưa trả đủ kết quả cho mọi CV. Vui lòng thử quét lại.');
      return candidates;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof SyntaxError) throw new BadGatewayException('Gemini trả về JSON không hợp lệ. Vui lòng thử lại.');
      const status = (error as { status?: number }).status;
      if (status === 400) throw new BadGatewayException(`Gemini từ chối dữ liệu gửi lên: ${error instanceof Error ? error.message : 'kiểm tra định dạng PDF và tổng dung lượng tệp.'}`);
      if (status === 401 || status === 403) throw new BadGatewayException('Gemini từ chối API key. Kiểm tra GEMINI_API_KEY.');
      if (status === 429) throw new BadGatewayException('Gemini đang chạm giới hạn sử dụng. Vui lòng thử lại sau.');
      if (status === 503) throw new BadGatewayException('Gemini đang quá tải tạm thời. Vui lòng thử quét lại sau ít phút.');
      throw new BadGatewayException('Không thể gọi Gemini lúc này. Kiểm tra kết nối mạng và cấu hình Gemini.');
    }
  }

  private filePart(file: Express.Multer.File): GeminiPart {
    const isDocx = file.originalname.toLowerCase().endsWith('.docx');
    return { inlineData: {
      mimeType: isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
      data: file.buffer.toString('base64'),
    } };
  }
  private scoreInRange(value: unknown) { return Math.max(0, Math.min(100, Math.round(Number(value) || 0))); }
}
