"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="zh-CN"><body style={{fontFamily:"system-ui, sans-serif",margin:"4rem auto",padding:"1rem",maxWidth:"42rem",color:"#152944"}}><main><p>Global Chain</p><h1>页面暂时没能打开</h1><p>请重新加载，或回到世界地图。</p><button onClick={reset}>重新加载</button> <a href="/map">返回世界地图</a></main></body></html>;
}
