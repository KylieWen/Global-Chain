import Image from "next/image";
import productPresentation from "../../../content/product-presentation.json";
import "./product-artwork.css";

const artworkByProduct: Readonly<Record<string, { image: string; alt: string }>> = productPresentation;

export function ProductArtwork({
  productId,
  variant = "catalog",
  decorative = false
}: {
  productId?: string;
  variant?: "catalog" | "hero" | "overview";
  decorative?: boolean;
}) {
  const artwork = productId ? artworkByProduct[productId] : undefined;

  return (
    <span className={`product-artwork product-artwork-${variant}`} aria-hidden={decorative || undefined}>
      {artwork ? (
        <Image
          src={artwork.image}
          alt={decorative ? "" : artwork.alt}
          width={480}
          height={320}
          sizes={variant === "hero" ? "(max-width: 760px) 80vw, 360px" : "(max-width: 640px) 65vw, 240px"}
        />
      ) : (
        <svg viewBox="0 0 480 320" fill="none" role={decorative ? undefined : "img"} aria-label={decorative ? undefined : "商品示意图，暂无专属配图"}>
          <ellipse cx="240" cy="270" rx="115" ry="15" fill="#6f9991" opacity=".12" />
          <g stroke="#648a87" strokeWidth="3" strokeLinejoin="round">
            <path d="m240 63 113 62v127l-113 62-113-62V125Z" fill="#c3ddd3" />
            <path d="m127 125 113 62 113-62-113-62Z" fill="#f9f8ee" />
            <path d="M240 187v127l113-62V125Z" fill="#b4b6d5" />
            <path d="m184 94 113 62v47" />
          </g>
        </svg>
      )}
    </span>
  );
}
