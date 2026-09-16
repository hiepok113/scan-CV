import './globals.css';
export const metadata = { title: 'HR CV Screener', description: 'Sàng lọc nhiều CV theo yêu cầu tuyển dụng bằng AI' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="vi"><body>{children}</body></html>; }
