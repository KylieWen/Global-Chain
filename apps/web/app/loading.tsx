import { SiteShell } from "../components/site-shell";

export default function LoadingPage() {
  return <SiteShell><div className="content-column wide-column"><div className="page-loading" role="status" aria-live="polite"><span className="loading-dot" aria-hidden="true"/><span>正在打开资料…</span></div></div></SiteShell>;
}
