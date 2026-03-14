import { SVGProps } from 'react'

export function VoxelLogoIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* White circle */}
      <circle cx="50" cy="50" r="50" fill="white" />

      {/* Thick bold lightning bolt — centered, clearly visible at any size */}
      <path
        d="M57 12L26 54H46L38 88L74 46H54L57 12Z"
        fill="#0a0f1e"
      />
    </svg>
  )
}

export function VoxelWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconSize  = { sm: 28, md: 36, lg: 52 }
  const textClass = { sm: 'text-lg', md: 'text-xl', lg: 'text-3xl' }

  return (
    <div className="flex items-center gap-2.5">
      <VoxelLogoIcon size={iconSize[size]} />
      <span className={`font-sora font-extrabold text-white tracking-tight ${textClass[size]}`}>
        VOXEL
      </span>
    </div>
  )
}
