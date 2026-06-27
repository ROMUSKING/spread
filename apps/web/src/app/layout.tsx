import "../styles/globals.css";
import { buildPreferencesBootstrapScript } from "../lib/preferencesUtils";

export const metadata = {
  title: "Spread ERP",
  description: "Spreadsheet-native ERP workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-density="comfortable" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildPreferencesBootstrapScript() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}