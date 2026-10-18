"use client";
import { Suspense } from "react";
import Relatorios from "@/components/views/Relatorios";
export default function Page() { return <Suspense fallback={null}><Relatorios /></Suspense>; }
