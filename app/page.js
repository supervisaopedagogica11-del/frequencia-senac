"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/useAuth";

export default function Home() {
  const user = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (user) router.replace("/painel");
  }, [user, router]);
  return null;
}
