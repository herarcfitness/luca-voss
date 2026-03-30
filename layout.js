import "./globals.css";

export const metadata = {
  title: "Luca Voss",
  description: "painter · chicago",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
