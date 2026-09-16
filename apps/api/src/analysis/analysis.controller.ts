import { BadRequestException, Body, Controller, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: 'cvs', maxCount: 20 }, { name: 'jobFile', maxCount: 1 }], { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 21 } }))
  async create(@UploadedFiles() files: { cvs?: Express.Multer.File[]; jobFile?: Express.Multer.File[] }, @Body('jobDescription') jobDescription: string, @Body('additionalRequirements') additionalRequirements: string, @Body('minimumScore') minimumScoreRaw: string, @Body('limit') limitRaw: string) {
    const cvs = files?.cvs ?? [];
    const jobFile = files?.jobFile?.[0];
    if (!cvs.length) throw new BadRequestException('Vui lòng tải lên ít nhất một CV PDF.');
    if (!jobFile && !jobDescription?.trim()) throw new BadRequestException('Hãy tải JD PDF hoặc dán mô tả công việc.');
    cvs.forEach((file) => {
      if (!file.originalname.toLowerCase().endsWith('.pdf')) throw new BadRequestException(`CV “${file.originalname}” không phải file PDF.`);
    });
    if (jobFile && !/\.(pdf|docx)$/i.test(jobFile.originalname)) {
      throw new BadRequestException(`JD “${jobFile.originalname}” phải là PDF hoặc DOCX.`);
    }
    const totalBytes = [...cvs, ...(jobFile ? [jobFile] : [])].reduce((total, file) => total + file.size, 0);
    const maxInlineBytes = 14 * 1024 * 1024;
    if (totalBytes > maxInlineBytes) throw new BadRequestException(`Tổng dung lượng JD và CV là ${(totalBytes / 1024 / 1024).toFixed(1)} MB. Một lượt quét trực tiếp chỉ nhận tối đa 14 MB trước khi mã hóa; hãy giảm số CV hoặc chia thành nhiều lượt.`);
    const minimumScore = this.numberInRange(minimumScoreRaw, 40, 0, 100);
    const limit = this.numberInRange(limitRaw, 20, 1, 20);
    const results = await this.analysis.screen(jobFile, jobDescription?.trim() || '', cvs, additionalRequirements?.trim() || '');
    const candidates = results.filter((candidate) => candidate.score >= minimumScore).sort((a, b) => b.score - a.score).slice(0, limit);
    return { totalUploaded: cvs.length, minimumScore, limit, matchedCount: candidates.length, candidates };
  }

  private numberInRange(value: string, fallback: number, min: number, max: number) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback; }
}
