"use client";

import { usePathname } from "next/navigation";
import {
  SidebarSimple,
  PencilSimple,
  DotsThree,
  Gear,
  SignOut,
  House,
  Clock,
  Bell,
  Moon,
  Envelope,
  CurrencyCircleDollar,
  Megaphone,
  ChatsCircle,
  ChartBar,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@leadsens/ui";
import { useSession, signOut } from "@/lib/auth-client";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

// ─── Component ──────────────────────────────────────────

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { toggleSidebar, isMobile, setOpenMobile } = useSidebar();

  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const firstName = userName.split(" ")[0] ?? "U";

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  useKeyboardShortcuts({});

  return (
    <Sidebar
      collapsible="offcanvas"
      className="overflow-hidden"
      style={{
        background: "var(--background)",
        borderRight: "1px solid rgba(23,195,178,0.15)",
      }}
    >
      {/* Header */}
      <SidebarHeader className="px-3 border-b" style={{ borderColor: "rgba(23,195,178,0.15)", height: '48px', minHeight: '48px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/logo-elevay.svg"
              alt="Elevay"
              width={22}
              height={22}
              className="shrink-0"
            />
            <span className="font-bold text-sm" style={{ color: "#17c3b2" }}>
              Elevay
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={toggleSidebar}
          >
            <SidebarSimple className="size-3.5" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 scrollbar-thin gap-0">
        {/* Navigation */}
        <SidebarGroup className="pt-2 pb-0">
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/"}
                onClick={() => { router.push("/"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <House className="size-3.5 shrink-0" />
                <span>Home</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/up-next")}
                onClick={() => { router.push("/up-next"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <Clock className="size-3.5 shrink-0" />
                <span>Up next</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/notifications")}
                onClick={() => { router.push("/notifications"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <Bell className="size-3.5 shrink-0" />
                <span>Notifications</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/brand-intel")}
                onClick={() => { router.push("/brand-intel"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <ChartBar className="size-3.5 shrink-0" />
                <span>Brand Intelligence</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/content-writer")}
                onClick={() => { router.push("/content-writer"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <PencilSimple className="size-3.5 shrink-0" />
                <span>Content Writer</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/crm-campaigns")}
                onClick={() => { router.push("/crm-campaigns"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <Envelope className="size-3.5 shrink-0" />
                <span>CRM Campaigns</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/budget")}
                onClick={() => { router.push("/budget"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <CurrencyCircleDollar className="size-3.5 shrink-0" />
                <span>Budget</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/social-campaigns")}
                onClick={() => { router.push("/social-campaigns"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <Megaphone className="size-3.5 shrink-0" />
                <span>Social Campaigns</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/social-inbox")}
                onClick={() => { router.push("/social-inbox"); if (isMobile) setOpenMobile(false); }}
                size="sm"
                className="px-2 rounded-lg text-sidebar-foreground/70 hover:bg-[rgba(23,195,178,0.06)] data-[active=true]:bg-[rgba(23,195,178,0.10)] data-[active=true]:text-foreground"
              >
                <ChatsCircle className="size-3.5 shrink-0" />
                <span>Social Inbox</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

      </SidebarContent>

      {/* Footer — user info + menu */}
      <SidebarFooter
        className="px-3 py-3 border-t"
        style={{ borderColor: "rgba(23,195,178,0.15)" }}
      >
        <div className="flex items-center gap-2">
          <Avatar className="size-7 rounded-lg shrink-0">
            {session?.user?.image && (
              <AvatarImage src={session.user.image} alt={userName} className="rounded-lg" />
            )}
            <AvatarFallback
              className="rounded-lg text-[11px] font-bold text-white"
              style={{ background: "var(--elevay-gradient-btn)" }}
            >
              {firstName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-foreground">{userName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground shrink-0"
                title="More"
              >
                <DotsThree className="size-4" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="min-w-[180px]">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate">
                {userEmail}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                router.push("/settings");
                if (isMobile) setOpenMobile(false);
              }}>
                <Gear className="size-3.5 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                document.documentElement.classList.toggle("dark");
              }}>
                <Moon className="size-3.5 mr-2" />
                Dark mode
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                router.push("/contact");
                if (isMobile) setOpenMobile(false);
              }}>
                <Envelope className="size-3.5 mr-2" />
                Contact the team
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <SignOut className="size-3.5 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>

      <SidebarRail />

    </Sidebar>
  );
}
