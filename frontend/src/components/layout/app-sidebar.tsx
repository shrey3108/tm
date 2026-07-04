import * as React from "react"
import { useAppSelector } from "@/store/hooks"
import { selectCurrentUser } from "@/store/slices/authSlice"
import { hasAnyPermission, hasPermissions, PERMISSIONS } from "@/lib/permissions"

/**
 * Application sidebar navigation with role-based menu sections.
 * Displays Platform (Recruitment) and System (Admin) navigation based on user permissions.
 * Collapsible with animated toggle between collapsed/expanded states.
 */
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { Logo, LogoIcon } from "@/components/logo"
import { cn } from "@/lib/utils"
import {
  BriefcaseIcon,
  ShieldAlertIcon,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  Users,
  Database,
  Settings2,
  Settings
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { ClearCacheDialog } from "./clear-cache-dialog"
// import { DefaultPathDialog } from "./default-path-dialog"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser)
  const userPermissions = user?.permissions ?? []
  const [isClearCacheDialogOpen, setIsClearCacheDialogOpen] = React.useState(false)
  // const [isDefaultPathDialogOpen, setIsDefaultPathDialogOpen] = React.useState(false)

  const canSeeAdminNav = hasAnyPermission(userPermissions, [
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.CANDIDATES_ACCESS,
    PERMISSIONS.DEPARTMENTS_ACCESS,
    PERMISSIONS.FILES_READ,
    PERMISSIONS.JOBS_ACCESS,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.SKILLS_ACCESS,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.SYSTEM_MANAGE,
    PERMISSIONS.ASSOCIATES_ACCESS,
  ])

  const navRecruitment = [
    {
      title: "Recruitment",
      url: "/dashboard",
      icon: BriefcaseIcon,
      isActive: true,
      items: [
        {
          title: "Job Board",
          url: "/dashboard/jobs",
          permission: PERMISSIONS.JOBS_ACCESS,
          // Hide from Platform if available in System (Admin) section
          hideIfAdmin: true,
        },
        {
          title: "Candidates",
          url: "/dashboard/candidates",
          permission: PERMISSIONS.CANDIDATES_ACCESS,
          hideIfAdmin: true,
        },
      ],
    },
  ].map((section) => ({
    ...section,
    items: section.items.filter((item: any) => {
      const hasPerm = hasPermissions(userPermissions, item.permission);
      if (!hasPerm) return false;

      // Deduplicate: If it's an admin-redundant link and user can see admin nav, hide it here
      if (item.hideIfAdmin && canSeeAdminNav) return false;

      return true;
    }),
  })).filter((section) => section.items.length > 0)

  const navAdmin = [
    {
      title: "Overview",
      url: "/dashboard/admin",
      icon: LayoutDashboard,
      items: [
        {
          title: "Dashboard",
          url: "/dashboard/admin",
          permission: PERMISSIONS.ANALYTICS_READ,
        },
      ],
    },
    {
      title: "Access Control",
      url: "/dashboard/admin/users",
      icon: Users,
      items: [
        {
          title: "Users",
          url: "/dashboard/admin/users",
          permission: PERMISSIONS.USERS_READ,
        },
        {
          title: "Roles",
          url: "/dashboard/admin/roles",
          permission: PERMISSIONS.ROLES_READ,
        },
      ],
    },
    {
      title: "Recruitment",
      url: "/dashboard/admin/jobs",
      icon: BriefcaseIcon,
      items: [
        {
          title: "Jobs",
          url: "/dashboard/admin/jobs",
          permission: PERMISSIONS.JOBS_ACCESS,
        },
        {
          title: "Candidates",
          url: "/dashboard/admin/candidates",
          permission: PERMISSIONS.CANDIDATES_ACCESS,
        },
      ],
    }, {
      title: "Job Stages & Criteria",
      url: "/dashboard/admin/criteria-stages",
      icon: Settings2,
      items: [
        {
          title: "Stages",
          url: "/dashboard/admin/criteria-stages/stages",
          permission: PERMISSIONS.ADMIN_ALL, // TODO: adjust as per backend API
        }, {
          title: "Criteria",
          url: "/dashboard/admin/criteria-stages/criteria",
          permission: PERMISSIONS.ADMIN_ALL, // TODO: adjust as per backend API
        }, {
          title: "Positions",
          url: "/dashboard/admin/criteria-stages/positions",
          permission: PERMISSIONS.ADMIN_ACCESS,
        },
        {
          title: "Questions Bank",
          url: "/dashboard/questions-bank",
          permission: PERMISSIONS.JOBS_ACCESS,
        },
        {
          title: "Associates",
          url: "/dashboard/admin/associates",
          permission: PERMISSIONS.ASSOCIATES_ACCESS,
        },
      ],
    },
    {
      title: "Skill & Department",
      url: "/dashboard/admin/skills",
      icon: Database,
      items: [
        {
          title: "Skills",
          url: "/dashboard/admin/skills",
          permission: PERMISSIONS.SKILLS_ACCESS,
        },
        {
          title: "Departments",
          url: "/dashboard/admin/departments",
          permission: PERMISSIONS.DEPARTMENTS_ACCESS,
        },
      ],
    }, {
      title: "Settings",
      url: "/dashboard/admin/settings",
      icon: Settings,
      items: [
        {
          title: "Priorities",
          url: "/dashboard/admin/settings/priorities",
          permission: PERMISSIONS.ADMIN_ACCESS, // TODO: adjust as per backend API
        },
        {
          title: "Prompts",
          url: "/dashboard/admin/settings/prompts",
          permission: [PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.ANALYTICS_READ], // TODO: adjust as per backend API
        },
        {
          title: "Terms & Conditions",
          url: "/dashboard/admin/settings/terms-conditions",
          permission: PERMISSIONS.ADMIN_ACCESS,
        },
        // {
        //   title: "Extraction Path",
        //   onClick: () => setIsDefaultPathDialogOpen(true),
        //   permission: PERMISSIONS.ADMIN_ACCESS,
        // },
        {
          title: "Clear Cache",
          onClick: () => setIsClearCacheDialogOpen(true),
          permission: PERMISSIONS.SYSTEM_MANAGE,
        }
      ],
    },
    {
      title: "Security & Logs",
      url: "/dashboard/admin/audit-logs",
      icon: ShieldAlertIcon,
      items: [
        {
          title: "Audit Logs",
          url: "/dashboard/admin/audit-logs",
          permission: PERMISSIONS.AUDIT_READ,
        },
        {
          title: "Recent Uploads",
          url: "/dashboard/admin/recent-uploads",
          permission: PERMISSIONS.FILES_READ,
        },
      ],
    },
  ].map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermissions(userPermissions, item.permission)),
  })).filter((section) => section.items.length > 0)


  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem
            className={cn(
              "flex gap-1 px-1.5 py-1 transition-all duration-200",
              isCollapsed
                ? "flex-col items-center justify-center gap-4 py-4"
                : "flex-row items-center justify-between"
            )}
          >
            <SidebarMenuButton
              size="lg"
              className={cn(
                "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-none",
                isCollapsed ? "h-auto w-auto p-0 flex justify-center items-center" : "flex-1"
              )}
              onClick={() => {
                navigate("/dashboard/admin");
              }}
            >
              {isCollapsed ? <LogoIcon /> : <Logo />}
            </SidebarMenuButton>
            <SidebarTrigger className="h-8 w-8 shrink-0 rounded-xl hover:bg-sidebar-accent">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </SidebarTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navRecruitment} label="Platform" />
        {canSeeAdminNav && <NavMain items={navAdmin} label="System" />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />

      <ClearCacheDialog
        open={isClearCacheDialogOpen}
        onOpenChange={setIsClearCacheDialogOpen}
      />
      {/* <DefaultPathDialog
        open={isDefaultPathDialogOpen}
        onOpenChange={setIsDefaultPathDialogOpen}
      /> */}
    </Sidebar>
  )
}
