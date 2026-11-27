import type { Metadata } from "next";
import { ParticleLab } from "../../../components/particle-lab";

export const metadata: Metadata = {
  title: "粒子流编码实验 · GlobeChain",
  robots: { index: false, follow: false }
};

export default function ParticleLabPage() {
  return <ParticleLab />;
}
