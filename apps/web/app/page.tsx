'use client';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';

type Candidate = { cvIndex: number; candidateName: string; fileName: string; score: number; summary: string; strengths: string[]; gaps: string[]; applicationAdvice: string };
type Response = { totalUploaded: number; minimumScore: number; matchedCount: number; candidates: Candidate[] };

function CandidateCard({ candidate, index, onPreview }:
  { candidate: Candidate; index: number; onPreview: (cvIndex: number) => void }) {
  return <article className="candidate"><div className="rank">#{index + 1}</div><div className="score"><strong>{candidate.score}</strong><span>/100</span></div><div className="candidate-copy"><div className="candidate-title"><div><h2>{candidate.candidateName}</h2><p className="filename">{candidate.fileName}</p></div><button type="button" className="preview-button" onClick={() => onPreview(candidate.cvIndex)}>Preview</button></div><p>{candidate.summary}</p><div className="details"><div><b>Điểm mạnh</b><ul>{candidate.strengths.slice(0, 3).map((item, i) => <li key={i}>{item}</li>)}</ul></div><div><b>Cần lưu ý</b><ul>{candidate.gaps.slice(0, 3).map((item, i) => <li key={i}>{item}</li>)}</ul></div></div><p className="advice"><b>Đề xuất: </b>{candidate.applicationAdvice}</p></div></article>;
}

export default function Home() {
  const [cvs, setCvs] = useState<File[]>([]), [jobFile, setJobFile] = useState<File | null>(null), [jobDescription, setJobDescription] = useState(''), [additionalRequirements, setAdditionalRequirements] = useState(''), [minimumScore, setMinimumScore] = useState(40), [limit, setLimit] = useState(20), [loading, setLoading] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<Response | null>(null), [previewFile, setPreviewFile] = useState<File | null>(null), [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
    if (!previewFile) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(previewFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);
  const addCvs = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    setCvs((current) => {
      const unique = incoming.filter((file) => !current.some((added) => added.name === file.name && added.size === file.size));
      if (current.length + unique.length > 20) setError('Mỗi lượt quét nhận tối đa 20 CV.');
      return [...current, ...unique].slice(0, 20);
    });
  };
  const previewCv = (cvIndex: number) => {
    const file = cvs[cvIndex - 1];
    if (!file) return setError('Không tìm thấy file CV gốc để xem trước. Hãy tải lại CV.');
    setPreviewFile(file);
  };
  const submit = async (e: FormEvent) => { e.preventDefault(); if (!cvs.length) return setError('Hãy tải lên ít nhất một CV.'); if (!jobFile && !jobDescription.trim() && !additionalRequirements.trim()) return setError('Hãy thêm JD hoặc yêu cầu tuyển dụng.'); setLoading(true); setError(''); setResult(null); const body = new FormData(); cvs.forEach(file => body.append('cvs', file)); if (jobFile) body.append('jobFile', jobFile); body.append('jobDescription', jobDescription); body.append('additionalRequirements', additionalRequirements); body.append('minimumScore', String(minimumScore)); body.append('limit', String(limit)); const api = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`; try { const response = await fetch(`${api}/analysis`, { method: 'POST', body }); const data = await response.json(); if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Có lỗi xảy ra'); setResult(data); } catch (err) { setError(err instanceof Error ? err.message : `Không thể kết nối API tại ${api}.`); } finally { setLoading(false); } };
  return <main><header><span className="logo">✦ HR CV Screener</span><h1>Sàng lọc CV với AI</h1><p>Chấm từng CV theo JD và yêu cầu HR, sau đó xếp hạng ứng viên phù hợp nhất.</p></header><form onSubmit={submit} className="form"><div className="form-grid"><label className="upload"><input type="file" multiple accept="application/pdf,.pdf" onChange={(e: ChangeEvent<HTMLInputElement>) => { addCvs(e.target.files); e.target.value = ''; }} /><span>{cvs.length ? `✓ Đã thêm ${cvs.length}/20 CV` : 'Tải CV ứng viên'}</span><small>PDF tối đa 5 MB/tệp; tổng JD và CV không quá 14 MB mỗi lượt</small></label><label className="upload"><input type="file" accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e: ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0] || null; setJobFile(file); if (file) setJobDescription(''); }} /><span>{jobFile ? `✓ ${jobFile.name}` : 'Tải JD PDF/DOCX (tuỳ chọn)'}</span><small>Hoặc dán nội dung JD phía dưới</small></label></div><label>Mô tả công việc (bắt buộc nếu không có JD file)<textarea disabled={Boolean(jobFile)} value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder={jobFile ? 'Đã dùng nội dung từ tệp JD đã tải lên.' : 'Dán mô tả công việc, trách nhiệm và tiêu chí tuyển dụng...'} /></label><label>Yêu cầu bổ sung<textarea className="short" value={additionalRequirements} onChange={e => setAdditionalRequirements(e.target.value)} placeholder="Ví dụ: tối thiểu 3 năm kinh nghiệm, giao tiếp tiếng Anh tốt, có thể đi làm trong tháng này..." /></label><div className="filters"><label>Ngưỡng phù hợp tối thiểu<input type="number" min="0" max="100" value={minimumScore} onChange={e => setMinimumScore(Number(e.target.value))} /><small>Mặc định 40%. Chỉ hiển thị CV đạt từ mức này.</small></label><label>Số ứng viên cần trả về<input type="number" min="1" max="20" value={limit} onChange={e => setLimit(Number(e.target.value))} /><small>Tối đa 20 CV, sắp xếp theo điểm giảm dần.</small></label></div>{error && <p className="error">{error}</p>}<button disabled={loading}>{loading ? `AI đang chấm ${cvs.length} CV ` : 'Bắt đầu quét bằng AI'}</button></form>{result && <section className="results"><div className="results-head"><h2>Kết quả sàng lọc</h2><p>Đã xét {result.totalUploaded} CV · hiển thị {result.matchedCount} ứng viên đạt từ {result.minimumScore}/100 · xếp theo điểm giảm dần</p></div>{result.candidates.length ? result.candidates.map((candidate, index) => <CandidateCard key={candidate.fileName} candidate={candidate} index={index} onPreview={previewCv} />) : <div className="empty">Chưa có CV nào đạt ngưỡng đã chọn. Hãy giảm ngưỡng phù hợp hoặc điều chỉnh yêu cầu.</div>}</section>}{previewFile && <div className="preview-overlay" role="dialog" aria-modal="true" aria-label={`Xem trước ${previewFile.name}`}><div className="preview-modal"><div className="preview-header"><div><b>Preview</b><span>{previewFile.name}</span></div><button type="button" className="close-preview" onClick={() => setPreviewFile(null)}>Đóng ×</button></div>{previewUrl && <iframe className="preview-frame" title={`CV ${previewFile.name}`} src={previewUrl} />}</div></div>}</main>;
}
