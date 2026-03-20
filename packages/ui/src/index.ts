// ─── Utilities ──────────────────────────────────────────
export { cn } from "./lib/utils";

// ─── Hooks ──────────────────────────────────────────────
export { useIsMobile } from "./hooks/use-mobile";

// ─── shadcn/ui components ───────────────────────────────
export { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "./ui/alert-dialog";
export { Alert, AlertTitle, AlertDescription } from "./ui/alert";
export { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
export { Badge, badgeVariants } from "./ui/badge";
export { Button, buttonVariants } from "./ui/button";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./ui/card";
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "./ui/dialog";
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup } from "./ui/dropdown-menu";
export { Input } from "./ui/input";
export { Progress } from "./ui/progress";
export { ScrollArea, ScrollBar } from "./ui/scroll-area";
export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton } from "./ui/select";
export { Separator } from "./ui/separator";
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from "./ui/sheet";
export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarInset, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar } from "./ui/sidebar";
export { Skeleton } from "./ui/skeleton";
export { Toaster } from "./ui/sonner";
export { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from "./ui/table";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
export { Textarea } from "./ui/textarea";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./ui/tooltip";

// ─── Chat primitives ────────────────────────────────────
export { ScrollToBottomPill } from "./chat/scroll-to-bottom";
export { UserMessage } from "./chat/user-message";
export { MessageActionsProvider, useMessageActions, type MessageActions } from "./chat/message-actions-context";
export { GreetingLoader } from "./chat/greeting-loader";
export { ThemeToggle } from "./chat/theme-toggle";
export { ThinkingBlock } from "./chat/thinking-block";
export { ActionBar } from "./chat/action-bar";
export { MARKDOWN_CLASS, StreamingMarkdownText } from "./chat/markdown";
export { BaseComposer } from "./chat/base-composer";
export { AgentActivityContext, useAgentActivity, type ThinkingStep, type AgentActivityContextValue } from "./chat/agent-activity-context";

// ─── Shared components ──────────────────────────────────
export { ThemeProvider } from "./theme-provider";
export { SidebarEdgeTrigger } from "./sidebar-edge-trigger";
export { GoogleLogo } from "./icons/google-logo";
