import { BottomNav }    from '@/components/layout/BottomNav'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { UserProvider } from '@/components/shared/UserProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="page-mobile">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto pb-28 pt-2">
          {children}
        </main>
        <BottomNav />
      </div>
    </UserProvider>
  )
}
