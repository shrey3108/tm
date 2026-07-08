import { useState, useRef } from "react"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  LogOut,
  Mail,
  Shield,
} from "lucide-react"
import { useAppSelector } from "@/store/hooks"
import { selectCurrentUser } from "@/store/slices/authSlice"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ModeToggle } from "./shared/mode-toggle"
import { Separator } from "@/components/ui/separator"
import { useOutsideClick } from "@/hooks/use-outside-click"
import { useLogoutMutation } from "@/hooks/mutations/auth/useAuthMutations"

export function NavUser() {
  const { state } = useSidebar()
  const user = useAppSelector(selectCurrentUser)
  const logoutMutation = useLogoutMutation()

  const [showProfileCard, setShowProfileCard] = useState(false)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>

  useOutsideClick(containerRef, () => {
    setShowProfileCard(false)
  }, showProfileCard)

  const isCollapsed = state === "collapsed"

  const handleLogout = () => {
    logoutMutation.mutate()
  }

  if (!user) return null

  return (
    <div className="relative" ref={containerRef}>
      {showProfileCard && (
        <div className={cn(
          "absolute bottom-full mb-2 p-2 rounded-2xl bg-popover border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 z-50",
          isCollapsed ? "left-0 w-64" : "left-0 right-0"
        )}>
          <div className="flex items-center gap-3 mb-2">
            <Avatar className="h-10 w-10 border border-border shrink-0">
              <AvatarFallback className="bg-green-100 text-green-700 font-bold">
                {user?.full_name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate uppercase tracking-widest text-[10px]">
                {user?.role_name || "User"}
              </p>
            </div>
          </div>

          <div className="space-y-1 mb-2">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Shield className="h-3 w-3 shrink-0" />
              <span className="truncate">{user?.role_name}</span>
            </div>
          </div>
          <Separator className="mb-1 opacity-80" />

          <div className="space-y-1">
            <div className="flex items-center justify-between pl-3 pr-1 py-1 rounded-xl bg-muted/50 border border-border/50">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Appearance
              </span>
              <ModeToggle className="h-8 w-8 rounded-lg border-none bg-transparent hover:bg-background/80" />
            </div>

            <Button
              variant="destructive"
              size="sm"
              className="w-full rounded-xl font-bold gap-2 text-[10px] uppercase tracking-widest h-8"
              onClick={() => setIsLogoutDialogOpen(true)}
            >
              <LogOut className="h-3 w-3" />
              Logout
            </Button>
          </div>

        </div>
      )}

      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            variant={showProfileCard ? "outline" : "default"}
            className={cn(
              "transition-all duration-200",
              showProfileCard ? "bg-muted text-foreground border-muted-foreground/20" : "hover:bg-muted"
            )}
            onClick={() => {
              setShowProfileCard(!showProfileCard)
            }}
            tooltip={user.full_name || undefined}
          >
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="bg-primary/10 text-primary font-bold rounded-lg border border-primary/20">
                {user.full_name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold">{user.full_name}</span>
              <span className="truncate text-[10px] text-muted-foreground uppercase tracking-widest">{user.role_name || "User"}</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[2rem] p-6 border-none ring-1 ring-border/50 shadow-2xl">
          <DialogHeader className="gap-3">
            <div className="h-12 w-12 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500 mx-auto">
              <LogOut className="h-6 w-6" />
            </div>
            <div className="space-y-1 text-center">
              <DialogTitle className="text-xl font-black tracking-tight text-foreground">
                Confirm Logout
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                Are you sure you want to sign out?
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-6">
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="h-10 rounded-xl font-bold text-sm"
            >
              Confirm Logout
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsLogoutDialogOpen(false)}
              className="h-10 rounded-xl font-bold text-muted-foreground text-sm"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
