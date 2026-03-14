export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-mobile">
      {/* Inline SVG logo — no import chain that could break */}
      <div className="flex items-center justify-center gap-2.5 px-6 pt-8 pb-4">
        <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="white" />
          <path d="M57 12L26 54H46L38 88L74 46H54L57 12Z" fill="#0a0f1e" />
        </svg>
        <span className="font-sora font-extrabold text-xl text-white tracking-tight">VOXEL</span>
      </div>
      {children}
    </div>
  )
}
