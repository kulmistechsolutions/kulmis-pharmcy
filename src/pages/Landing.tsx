import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  BellRing,
  CreditCard,
  Cuboid,
  Layers,
  Mail,
  Pill,
  Menu,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Users2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

const systemStats = [
  { label: 'Active Pharmacies', value: '1,200+', description: 'Kulmis workspaces live across Somalia.' },
  { label: 'Medicines Tracked', value: '500K+', description: 'Inventory records flowing through Kulmis.' },
  { label: 'Invoices Generated Monthly', value: '85K+', description: 'Sales, lab, and expense documents synced.' },
  { label: 'Average Support Response', value: '3 min', description: '24/7 WhatsApp, phone, and email coverage.' },
]

const freeTrialHighlights = [
  {
    title: 'Automatic Onboarding',
    description: 'Every new pharmacy receives a 30-day full-access trial the moment registration completes—no extra setup.',
  },
  {
    title: 'Smart Reminders',
    description: 'Kulmis notifies pharmacy owners three days before a trial or paid plan expires and again on expiry.',
  },
  {
    title: 'Admin Control Center',
    description: 'Super Admin can pause, extend, or end trials, edit duration, and approve upgrade requests from one dashboard.',
  },
]

const moduleCards = [
  {
    title: 'Sales & POS',
    description: 'Capture cash or credit sales, issue receipts, and keep every invoice synced across branches.',
    icon: CreditCard,
  },
  {
    title: 'Inventory Control',
    description: 'Track batches, expiries, suppliers, and automated reorder levels with a live stock ledger.',
    icon: Layers,
  },
  {
    title: 'Reports & Analytics',
    description: 'Monitor profit, expenses, and staff KPIs with interactive dashboards and exportable reports.',
    icon: BarChart3,
  },
  {
    title: 'Debts & Messaging',
    description: 'Log customer balances, send WhatsApp/SMS reminders, and keep payment histories organised.',
    icon: BellRing,
  },
  {
    title: 'Lab Cashier',
    description: 'Record lab payments, link to patients, and reconcile revenue beside pharmacy sales.',
    icon: Cuboid,
  },
  {
    title: 'Notifications & Automation',
    description: 'Stay informed with low-stock alerts, new sale pings, subscription reminders, and admin broadcasts.',
    icon: Activity,
  },
]

const workflowSteps = [
  {
    title: 'Configure Kulmis in minutes',
    description: 'Create your workspace, add staff roles, import catalogues, and apply pharmacy branding.',
    icon: Sparkles,
  },
  {
    title: 'Run daily operations seamlessly',
    description: 'Sell, manage lab cashiering, record expenses, and capture debts—even offline with sync queues.',
    icon: Users2,
  },
  {
    title: 'Analyse & grow confidently',
    description: 'Review live dashboards, drill into reports, and plan promotions with accurate, real-time data.',
    icon: TrendingUp,
  },
  {
    title: 'Scale with smart automation',
    description: 'Automate reminders, integrate with messaging and accounting tools, and unlock premium analytics.',
    icon: ShieldCheck,
  },
]

const metricHighlights = [
  { value: '99.9%', label: 'Sync reliability across web, tablet, and mobile devices.' },
  { value: '30 mins', label: 'Average go-live time for new pharmacies onboarding to Kulmis.' },
  { value: '78%', label: 'Average reduction in manual reconciliation work per week.' },
  { value: '24/7', label: 'Customer support availability through WhatsApp, phone, and email.' },
]

const testimonialCards = [
  {
    quote: 'Kulmis keeps our staff aligned. We see live sales, stock, and lab revenue without waiting for end-of-day calls.',
    name: 'Pharm. Ayaan',
    role: 'Owner, Mogadishu',
  },
  {
    quote: 'Offline mode is a lifesaver. Transactions sync automatically once the network returns—no duplicates, no stress.',
    name: 'Pharm. Mahad',
    role: 'Pharmacy Manager, Hargeisa',
  },
  {
    quote: 'Debt reminders via WhatsApp improved our collections by 60%. Kulmis handles the follow-up for us.',
    name: 'Pharm. Liibaan',
    role: 'Operations Lead, Beledweyne',
  },
]

export const Landing: React.FC = () => {
  const navigate = useNavigate()
  const [showDemo, setShowDemo] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const scrollToFeatures = () => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })
  const scrollToWorkflow = () => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })

  const navLinks = [
    {
      label: 'Home',
      onClick: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setMobileMenuOpen(false)
      },
    },
    {
      label: 'Modules',
      onClick: () => {
        scrollToFeatures()
        setMobileMenuOpen(false)
      },
    },
    {
      label: 'How it Works',
      onClick: () => {
        scrollToWorkflow()
        setMobileMenuOpen(false)
      },
    },
  ]

  return (
    <div className="min-h-screen bg-[#f4f5ff] text-slate-900">
      {/* Navigation */}
      <header className="border-b border-white/40 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6C63FF] text-white shadow-lg shadow-[#6C63FF]/40">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-['Poppins'] text-lg font-semibold text-[#1f1f3d]">Kulmis Pharmacy Platform</p>
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-slate-400">Empowering Pharmacies with Smart Digital Solutions</p>
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:flex">
            {navLinks.map((link) => (
              <button
                key={link.label}
                className="whitespace-nowrap transition hover:text-[#6C63FF]"
                onClick={link.onClick}
              >
                {link.label}
              </button>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:ml-6 md:flex lg:ml-12">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-[#6C63FF]" onClick={() => navigate('/login')}>
              Log in
            </Button>
            <Button size="sm" className="bg-[#6C63FF] text-white hover:bg-[#5a54f0]" onClick={() => navigate('/register')}>
              Start Free Trial
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        <div className="mx-auto hidden w-full max-w-6xl items-center justify-between gap-3 px-6 pb-4 md:hidden">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-full border-[#6C63FF]/30 text-[#6C63FF] hover:bg-[#6C63FF]/10"
            onClick={() => navigate('/login')}
          >
            Log in
          </Button>
          <Button
            size="sm"
            className="flex-1 rounded-full bg-[#6C63FF] text-white hover:bg-[#5a54f0]"
            onClick={() => navigate('/register')}
          >
            Register
          </Button>
        </div>
        {mobileMenuOpen && (
          <div className="mx-auto w-full max-w-6xl space-y-4 px-6 pb-6 md:hidden">
            <div className="flex flex-col gap-3 rounded-2xl border border-[#6C63FF]/20 bg-white p-5 shadow-sm">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  className="rounded-full px-4 py-2 text-left text-sm font-medium text-slate-600 hover:bg-[#f0eeff] hover:text-[#6C63FF]"
                  onClick={link.onClick}
                >
                  {link.label}
                </button>
              ))}
              <div className="h-px bg-slate-200" />
              <Button className="w-full rounded-full bg-[#6C63FF] text-white hover:bg-[#5a54f0]" onClick={() => navigate('/register')}>
                Start Free Trial
              </Button>
              <Button variant="outline" className="w-full rounded-full border-[#6C63FF]/30 text-[#6C63FF] hover:bg-[#6C63FF]/10" onClick={() => navigate('/login')}>
                Log in
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute -right-32 top-16 hidden h-72 w-72 rounded-full bg-[#6C63FF]/20 blur-[120px] lg:block" />
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#6C63FF]/30 px-4 py-2 text-xs font-semibold uppercase text-[#6C63FF]">
              Modernise your pharmacy in one platform
            </div>
            <h1 className="font-['Poppins'] text-4xl font-bold leading-tight text-[#1f1f3d] md:text-[3.2rem]">
              Run sales, inventory, lab, and debts with Kulmis—online or offline.
            </h1>
            <p className="max-w-2xl text-base text-slate-500">
              Kulmis unifies every pharmacy workflow: sales, stock, lab cashiering, debt management, and
              real-time reporting. Teams stay coordinated from tills to head office, even when the internet drops.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button size="lg" className="rounded-full bg-[#6C63FF] px-6 text-white hover:bg-[#5a54f0] sm:w-auto" onClick={() => setShowDemo(true)}>
                Watch a Demo
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-[#6C63FF]/30 bg-white px-6 text-[#6C63FF] hover:bg-[#6C63FF]/10 sm:w-auto"
                onClick={scrollToFeatures}
              >
                Explore Modules
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex -space-x-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-10 w-10 rounded-full border-2 border-white bg-gradient-to-br from-[#6C63FF] to-[#A084FF]" />
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1f1f3d]">1,200+ Pharmacies onboarded</p>
                <p className="text-xs text-slate-400">4.8/5 customer satisfaction rating</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[30px] bg-[#f7f7ff] p-6 shadow-2xl">
              <div className="flex h-64 w-full flex-col items-center justify-center gap-4 rounded-3xl bg-gradient-to-br from-[#6C63FF] to-[#9C8BFF] text-white shadow-lg">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 backdrop-blur">
                  <Pill className="h-12 w-12" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">Kulmis Platform</p>
                  <h3 className="mt-3 font-['Poppins'] text-2xl font-semibold">Pharmacy Intelligence Hub</h3>
                  <p className="mt-2 max-w-xs text-sm text-white/80">Inventory • Sales • Lab • Debts</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* System overview stats */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl space-y-6 px-6 py-12 md:px-10">
          <div className="text-center space-y-3">
            <p className="font-['Poppins'] text-sm font-semibold uppercase tracking-[0.35em] text-[#6C63FF]">Kulmis Reach</p>
            <h2 className="font-['Poppins'] text-3xl font-bold text-[#1f1f3d]">A unified platform for pharmacies nationwide</h2>
            <p className="mx-auto max-w-3xl text-base text-slate-500">
              Kulmis connects owners, staff, and patients across thousands of daily interactions—from medicine stock and lab payments to financial reports and notifications.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {systemStats.map((stat) => (
              <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7f7aad]">{stat.label}</p>
                <p className="mt-3 font-['Poppins'] text-3xl font-semibold text-[#1f1f3d]">{stat.value}</p>
                <p className="mt-2 text-sm text-slate-500">{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free trial journey */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl space-y-10 px-6 pb-16 md:px-10">
          <div className="text-center space-y-4">
            <p className="font-['Poppins'] text-sm font-semibold uppercase tracking-[0.35em] text-[#6C63FF]">Free Trial Experience</p>
            <h2 className="font-['Poppins'] text-3xl font-bold text-[#1f1f3d]">Explore Kulmis for 30 days—guided every step of the way</h2>
            <p className="mx-auto max-w-3xl text-base text-slate-500">
              Activate your pharmacy in minutes, trial every module, and upgrade only when you are ready. Super Admins manage the lifecycle centrally while Kulmis keeps teams informed.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {freeTrialHighlights.map((item) => (
              <div key={item.title} className="rounded-3xl border border-slate-200 bg-[#f7f7ff] px-6 py-6 shadow-sm">
                <h3 className="font-['Poppins'] text-lg font-semibold text-[#1f1f3d]">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-[#ecebff] bg-[#fbf9ff] p-6 text-sm text-slate-500 shadow-sm">
            <p className="font-['Poppins'] text-sm font-semibold uppercase tracking-[0.3em] text-[#6C63FF]">Trial timeline</p>
            <ol className="mt-4 grid gap-3 md:grid-cols-4">
              <li className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7f7aad]">Day 0</p>
                <p className="mt-2 text-sm text-slate-600">Pharmacy registers, trial starts automatically, and dashboard shows remaining days.</p>
              </li>
              <li className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7f7aad]">Day 27</p>
                <p className="mt-2 text-sm text-slate-600">System sends “trial expiring soon” via in-app notifications and email.</p>
              </li>
              <li className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7f7aad]">Day 30</p>
                <p className="mt-2 text-sm text-slate-600">Trial expires if no upgrade—dashboard locks with upgrade CTA.</p>
              </li>
              <li className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7f7aad]">Upgrade</p>
                <p className="mt-2 text-sm text-slate-600">User submits upgrade, Super Admin approves, and Kulmis unlocks paid plan features.</p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="bg-white">
        <div className="mx-auto max-w-6xl space-y-6 px-6 py-16 text-center">
          <Button variant="ghost" size="sm" className="mx-auto rounded-full border border-[#6C63FF]/30 px-4 text-xs font-semibold uppercase tracking-[0.35em] text-[#6C63FF]">
            Kulmis Modules
          </Button>
          <h2 className="font-['Poppins'] text-3xl font-bold text-[#1f1f3d] md:text-[2.6rem]">Everything your pharmacy needs to stay organised</h2>
          <p className="mx-auto max-w-3xl text-base text-slate-500">
            Kulmis combines POS, inventory, lab, debt management, and automated communications into an intuitive digital
            workspace designed with Somali pharmacies.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 px-6 pb-10 md:grid-cols-2 xl:grid-cols-3">
          {moduleCards.map((module) => (
            <div key={module.title} className="rounded-[32px] bg-[#f7f7ff] p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#6C63FF] shadow">
                <module.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-6 font-['Poppins'] text-xl font-semibold text-[#1f1f3d]">{module.title}</h3>
              <p className="mt-3 text-sm text-slate-500">{module.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="bg-white">
        <div className="mx-auto max-w-6xl space-y-10 px-6 pb-20 md:px-10">
          <div className="text-center space-y-3">
            <p className="font-['Poppins'] text-sm font-semibold uppercase tracking-[0.35em] text-[#6C63FF]">How Kulmis Works</p>
            <h2 className="font-['Poppins'] text-3xl font-bold text-[#1f1f3d]">A guided path from setup to growth</h2>
            <p className="mx-auto max-w-3xl text-base text-slate-500">
              Kulmis was built with pharmacy owners, lab leads, and cashiers. Every step keeps teams efficient and patients cared for.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {workflowSteps.map((step) => (
              <div key={step.title} className="flex items-start gap-4 rounded-[28px] border border-white bg-[#f7f7ff] p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#6C63FF] shadow">
                  <step.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-['Poppins'] text-lg font-semibold text-[#1f1f3d]">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-[#edeaff] px-6 py-6">
            <div>
              <p className="font-['Poppins'] text-lg font-semibold text-[#1f1f3d]">Need hands-on onboarding?</p>
              <p className="text-sm text-slate-500">Our success team migrates data, trains staff, and configures automation for multi-branch groups.</p>
            </div>
            <Button variant="secondary" className="rounded-full bg-[#6C63FF] px-6 text-white hover:bg-[#5a54f0]" onClick={() => navigate('/register')}>
              Book implementation support
            </Button>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="bg-gradient-to-r from-[#6C63FF] via-[#908CFF] to-[#6C63FF] text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-16 md:flex-row md:items-center">
          <div className="md:w-1/3 space-y-2">
            <p className="font-['Poppins'] text-sm font-semibold uppercase tracking-[0.35em] text-white/70">Performance Metrics</p>
            <h2 className="font-['Poppins'] text-3xl font-bold">Built for reliable pharmacy operations</h2>
            <p className="text-sm text-white/80">Whether you operate one branch or ten, Kulmis keeps every process transparent and accountable.</p>
          </div>
          <div className="grid flex-1 gap-4 md:grid-cols-2">
            {metricHighlights.map((metric) => (
              <div key={metric.value} className="rounded-3xl border border-white/20 bg-white/10 px-6 py-5 shadow-lg">
                <p className="font-['Poppins'] text-3xl font-semibold text-white">{metric.value}</p>
                <p className="mt-2 text-sm text-white/80">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl space-y-8 px-6 py-20 md:px-10">
          <div className="text-center space-y-3">
            <p className="font-['Poppins'] text-sm font-semibold uppercase tracking-[0.35em] text-[#6C63FF]">Testimonials</p>
            <h2 className="font-['Poppins'] text-3xl font-bold text-[#1f1f3d]">Trusted by pharmacies across Somalia</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonialCards.map((card) => (
              <div key={card.name} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-base italic text-slate-700">“{card.quote}”</p>
                <div className="mt-6">
                  <p className="font-['Poppins'] text-sm font-semibold text-[#1f1f3d]">{card.name}</p>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#6C63FF]">{card.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support CTA */}
      <section className="border-t border-white/40 bg-[#0f1632] text-slate-200">
        <div className="mx-auto max-w-6xl space-y-8 px-6 py-16 pb-20 md:px-10">
          <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div className="space-y-4">
              <p className="font-['Poppins'] text-sm font-semibold uppercase tracking-[0.35em] text-[#6C63FF]">Always here to help</p>
              <h2 className="font-['Poppins'] text-3xl font-bold text-white">Talk to the Kulmis success team today</h2>
              <p className="text-sm text-slate-400">
                Need customised training, multiple locations, or API integrations? Our consultants guide you through
                every step and share best practices from top-performing pharmacies.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-[#151b38] p-6">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Mail className="h-5 w-5 text-[#6C63FF]" /> support@kulmispharmacy.com
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Users className="h-5 w-5 text-[#6C63FF]" /> +252 613 609678 (WhatsApp & Call)
              </div>
              <Button className="mt-2 bg-[#6C63FF] text-white hover:bg-[#5a54f0]" onClick={() => navigate('/register')}>
                Start free trial now
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f1632] text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-12 md:grid-cols-4 md:px-10">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6C63FF] text-white">
                <Users className="h-5 w-5" />
              </div>
              <p className="font-['Poppins'] text-lg font-semibold text-white">Kulmis Pharmacy Platform</p>
            </div>
            <p className="text-sm text-slate-400">
              Kulmis is the comprehensive operations platform for Somali pharmacies—covering sales, inventory, lab,
              debts, notifications, and subscriptions with offline resilience and enterprise security.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-full bg-[#6C63FF] px-5 text-white hover:bg-[#5a54f0]" size="sm" onClick={() => navigate('/register')}>
                Start Free Trial
              </Button>
              <Button variant="outline" size="sm" className="rounded-full border-white/40 text-slate-200 hover:bg-white/10" onClick={scrollToFeatures}>
                Explore Modules
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <p className="font-['Poppins'] text-sm font-semibold uppercase tracking-[0.3em] text-white">Product</p>
            <button className="block text-left text-sm text-slate-400 hover:text-white" onClick={scrollToFeatures}>
              Modules
            </button>
            <button className="block text-left text-sm text-slate-400 hover:text-white" onClick={scrollToWorkflow}>
              How it works
            </button>
            <button className="block text-left text-sm text-slate-400 hover:text-white" onClick={() => navigate('/login')}>
              Login
            </button>
          </div>
          <div className="space-y-3">
            <p className="font-['Poppins'] text-sm font-semibold uppercase tracking-[0.3em] text-white">Stay Updated</p>
            <div className="rounded-2xl border border-white/20 bg-[#151b38] p-4">
              <p className="text-sm text-slate-400">Join the Kulmis release newsletter.</p>
              <input
                type="email"
                placeholder="Enter your email"
                className="mt-3 w-full rounded-xl border border-white/20 bg-[#151b38] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]"
              />
              <Button className="mt-3 w-full" size="sm" onClick={() => setShowDemo(true)}>
                Subscribe
              </Button>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Kulmis Pharmacy Platform. All rights reserved.
        </div>
      </footer>

      {/* Demo Modal */}
      {showDemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <button
              className="absolute right-4 top-4 rounded-full bg-white/80 p-2 text-slate-600 shadow hover:bg-white"
              onClick={() => setShowDemo(false)}
              aria-label="Close demo"
            >
              ✕
            </button>
            <div className="aspect-video w-full bg-slate-200">
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/ysz5S6PUM-U"
                title="Kulmis overview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


