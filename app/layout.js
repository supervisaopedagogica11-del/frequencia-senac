import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "./globals.css";
import DataProvider from "@/components/DataProvider";
import AppFrame from "@/components/AppFrame";


export const metadata = {
  title: "Frequência e Permanência — Senac Três Corações",
  description: "Acompanhamento preventivo de frequência, permanência e evasão — Supervisão Pedagógica",
};
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#3730A3" };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <DataProvider><AppFrame>{children}</AppFrame></DataProvider>
      </body>
    </html>
  );
}
