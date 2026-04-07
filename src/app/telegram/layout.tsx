import Script from "next/script";

export const metadata = {
  title: "OKrunit - Telegram",
};

export default function TelegramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      {children}
    </>
  );
}
