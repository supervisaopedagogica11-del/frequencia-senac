"use client";
import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useData } from "@/components/DataProvider";
import Shell from "@/components/Shell";

// Moldura do sistema: exige login e mostra o menu lateral em todas as páginas, exceto /login
export default function AppFrame({ children }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/") return children;
  return <AreaRestrita>{children}</AreaRestrita>;
}

function AreaRestrita({ children }) {
  const { user, usuario, autorizado, pronto } = useData();
  const router = useRouter();
  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (user && usuario && !autorizado) router.replace("/login");
  }, [user, usuario, autorizado, router]);
  if (!autorizado || !pronto) return <div className="loading"><Loader2 className="spin" size={20} /> Carregando...</div>;
  return (
    <Shell>
      <Suspense fallback={<div className="loading"><Loader2 className="spin" size={20} /></div>}>{children}</Suspense>
    </Shell>
  );
}
