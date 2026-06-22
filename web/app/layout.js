import "./globals.css";

export const metadata = {
  title: "RD Companion",
  description: "Real-Debrid Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
