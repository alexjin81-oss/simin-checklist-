import './globals.css';

export const metadata = {
  title: '시민제과 직원앱',
  description: '시민제과 매장 체크리스트 및 재고 관리',
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
