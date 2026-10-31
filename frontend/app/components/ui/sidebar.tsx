"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { PanelLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { useIsCompact } from "@/hooks/useIsCompact";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type SidebarState = "expanded" | "collapsed";

type SidebarContextValue = {
  state: SidebarState;
  toggleSidebar: () => void;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider");
  return ctx;
}

export function SidebarProvider({
  defaultOpen = true,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { defaultOpen?: boolean }) {
  const isMobile = useIsCompact();
  const [open, setOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);
  const state: SidebarState = open ? "expanded" : "collapsed";

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((o) => !o);
    } else {
      setOpen((o) => !o);
    }
  }, [isMobile]);

  return (
    <SidebarContext.Provider value={{ state, toggleSidebar, isMobile, openMobile, setOpenMobile }}>
      {/* display:contents keeps this a no-op in layout terms — the flex wrapper lives in the consumer */}
      <div data-state={state} className={cn("contents", className)} {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}) {
  const ctx = useSidebar();
  const { state, isMobile, openMobile, setOpenMobile } = ctx;
  const collapsed = collapsible === "icon" && state === "collapsed";

  // Recolhida: abre ao passar o cursor (ou ao navegar com o teclado), por cima
  // do conteúdo, sem o empurrar; fecha ao sair.
  const [espreitar, setEspreitar] = React.useState(false);
  const atrasoRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abrir = () => {
    if (!collapsed) return;
    if (atrasoRef.current) clearTimeout(atrasoRef.current);
    atrasoRef.current = setTimeout(() => setEspreitar(true), 120);
  };
  const fechar = () => {
    if (atrasoRef.current) clearTimeout(atrasoRef.current);
    setEspreitar(false);
  };
  React.useEffect(() => {
    if (!collapsed) setEspreitar(false);
  }, [collapsed]);
  const estreita = collapsed && !espreitar;

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side="left"
          className="w-64 bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-foreground"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Navegação principal da plataforma EYK.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col overflow-hidden">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }


  return (
    // Ocupa sempre a largura da barra no estado real (recolhida ou aberta).
    <div
      className={cn(
        "shrink-0 movel:hidden transition-[width] duration-200 ease-linear",
        variant === "floating"
          ? collapsed ? "w-[4.5rem]" : "w-[17rem]"
          : collapsed ? "w-[3.5rem]" : "w-64",
      )}
    >
      <aside
        data-state={estreita ? "collapsed" : "expanded"}
        data-variant={variant}
        data-collapsible={collapsible}
        onMouseEnter={abrir}
        onMouseLeave={fechar}
        onFocusCapture={abrir}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) fechar();
        }}
        className={cn(
          "sticky top-0 z-40 flex h-screen flex-col text-sidebar-foreground transition-[width] duration-200 ease-linear",
          estreita ? "w-[3.5rem]" : "w-64",
          variant === "floating"
            ? "m-2 h-[calc(100vh-1rem)] rounded-2xl border border-sidebar-border bg-sidebar shadow-soft"
            : "border-r border-sidebar-border bg-sidebar",
          espreitar && "shadow-elevated",
          className,
        )}
        {...props}
      >
        <SidebarContext.Provider value={{ ...ctx, state: estreita ? "collapsed" : "expanded" }}>
          <div className="flex h-full w-full flex-col overflow-hidden">{children}</div>
        </SidebarContext.Provider>
      </aside>
    </div>
  );
}

export function SidebarTrigger({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar, state, isMobile } = useSidebar();
  if (!isMobile && state === "collapsed") return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11", className)}
      onClick={toggleSidebar}
      aria-label="Alternar barra lateral"
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
    </Button>
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-auto flex flex-col gap-2", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-2", className)}
      {...props}
    />
  );
}

export function SidebarSeparator({ className, ...props }: React.ComponentProps<"hr">) {
  return <hr className={cn("mx-2 my-2 border-t border-sidebar-border", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />;
}

/** Título de um grupo (ex: "Professor"). Esconde-se com a barra recolhida. */
export function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"p">) {
  const { state, isMobile } = useSidebar();
  if (!isMobile && state === "collapsed") return null;
  return (
    <p
      className={cn("px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60", className)}
      {...props}
    />
  );
}

export function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("w-full", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("relative", className)} {...props} />;
}

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string;
  }
>(({ asChild = false, isActive = false, tooltip, className, ...props }, ref) => {
  const { state, isMobile } = useSidebar();
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-active={isActive}
      title={!isMobile && state === "collapsed" ? tooltip : undefined}
      className={cn(
        "flex w-full items-center overflow-hidden rounded-lg text-left text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring [&>svg]:shrink-0",
        !isMobile && state === "collapsed"
          ? "gap-2 p-2 text-sm [&>svg]:size-4"
          : "gap-3 px-3 py-2.5 text-[0.9375rem] [&>svg]:size-[1.125rem]",
        className,
      )}
      {...props}
    />
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";
