"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { GalleryVerticalEndIcon, AudioLinesIcon, TerminalIcon, TerminalSquareIcon, BotIcon, BookOpenIcon, Settings2Icon, FrameIcon, PieChartIcon, MapIcon, SpeakerIcon, UserIcon } from "lucide-react"

// This is sample data.
const data = {
  user: {
    name: "marketing",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Manager",
      logo: (
        <GalleryVerticalEndIcon
        />
      ),
      plan: "Manager",
    },
    {
      name: "Agent",
      logo: (
        <AudioLinesIcon
        />
      ),
      plan: "Agent",
    },
    {
      name: "Admin",
      logo: (
        <TerminalIcon
        />
      ),
      plan: "Admin",
    },
  ],
  navMain: [
    {
      title: "Campaign",
      url: "#",
      icon: (
        <SpeakerIcon
        />
      ),
      items: [
        {
          title: "Lists",
          url: "/dashboard/campaign/lists",
        },
        {
          title: "Campaigns",
          url: "/dashboard/campaign/campaigns",
        },
        {
          title: "Schedule",
          url: "/dashboard/campaign/schedule",
        },
        {
          title: "Reports",
          url: "/dashboard/campaign/reports",
        },
      ],
    },
    {
      title: "Admin",
      url: "#",
      icon: (
        <UserIcon
        />
      ),
      items: [
        {
          title: "Agents",
          url: "/dashboard/admin/agents",
        },
        {
          title: "Roster",
          url: "/dashboard/admin/roster",
        },
        {
          title: "Campaigns",
          url: "/dashboard/admin/campaign-settings",
        },
      ],
    },
    {
      title: "Documentation",
      url: "#",
      icon: (
        <BookOpenIcon
        />
      ),
      items: [
        {
          title: "Introduction",
          url: "#",
        },
        {
          title: "Get Started",
          url: "#",
        },
        {
          title: "Tutorials",
          url: "#",
        },
        {
          title: "Changelog",
          url: "#",
        },
      ],
    },
    // {
    //   title: "Settings",
    //   url: "#",
    //   icon: (
    //     <Settings2Icon
    //     />
    //   ),
    //   items: [
    //     {
    //       title: "General",
    //       url: "#",
    //     },
    //     {
    //       title: "Team",
    //       url: "#",
    //     },
    //     {
    //       title: "Billing",
    //       url: "#",
    //     },
    //     {
    //       title: "Limits",
    //       url: "#",
    //     },
    //   ],
    // },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: (
        <FrameIcon
        />
      ),
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: (
        <PieChartIcon
        />
      ),
    },
    {
      name: "Travel",
      url: "#",
      icon: (
        <MapIcon
        />
      ),
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
