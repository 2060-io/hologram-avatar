import {
  Building2,
  MessageSquare,
  Github,
  Smartphone,
  ExternalLink,
  ArrowDown,
  Shield,
  Bot,
  KeyRound,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Service data                                                       */
/* ------------------------------------------------------------------ */

const services = [
  {
    name: "Organization VS",
    role: "Trust Anchor",
    desc: "The root of trust for this ecosystem. Registers with the Verana Network, creates a Trust Registry, and issues Service credentials to child services.",
    icon: Building2,
    color: "text-amber-600 bg-amber-50",
    endpoint: null,
    workflow: "1_deploy-organization-vs",
  },
  {
    name: "Avatar",
    role: "Credential Issuer",
    desc: "A DIDComm chatbot that issues verifiable credentials to users through conversational interactions in Hologram Messaging.",
    icon: MessageSquare,
    color: "text-violet-600 bg-violet-50",
    endpoint: "https://avatar.vs.hologram.zone",
    workflow: "2_deploy-avatar",
  },
  {
    name: "GitHub Agent",
    role: "AI Agent + MCP",
    desc: "An AI-powered GitHub assistant with MCP integration. Search repositories, browse issues, pull requests, and code — all through a DIDComm chatbot in Hologram Messaging.",
    icon: Github,
    color: "text-gray-800 bg-gray-100",
    endpoint: "https://github-agent.vs.hologram.zone",
    workflow: "3_deploy-github-agent",
  },
];

const steps = [
  {
    number: 1,
    title: "Install Hologram Messaging",
    desc: "Download the mobile wallet app. It stores your credentials and communicates with services using DIDComm — an encrypted, peer-to-peer messaging protocol.",
    icon: Smartphone,
  },
  {
    number: 2,
    title: "Connect to a service",
    desc: "Visit a service endpoint (e.g. Issuer Chatbot or GitHub Agent) and scan the QR code with Hologram Messaging to establish an encrypted DIDComm connection.",
    icon: KeyRound,
  },
  {
    number: 3,
    title: "Interact via chat",
    desc: "The service appears as a contact in Hologram. Chat with it to receive credentials, ask questions, or interact with AI agents — all encrypted end-to-end.",
    icon: Bot,
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="relative bg-gradient-to-br from-[#764ba2] via-[#667eea] to-[#667eea] text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <img
            src="https://hologram.zone/logo.svg"
            alt="Hologram"
            className="h-12 mx-auto mb-6 rounded-xl"
          />
          <p className="text-white/70 text-sm font-medium tracking-wider uppercase mb-3">
            Hologram Avatar
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Verifiable Services Showcase
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
            A collection of Verifiable Services (VS) that demonstrate how
            AI agents, credential issuers, and chatbots operate within the
            Hologram + Verana ecosystem — all communicating through encrypted
            DIDComm channels.
          </p>
          <a
            href="#services"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur text-white font-medium transition-colors"
          >
            Explore Services <ArrowDown className="w-4 h-4" />
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-20">
        {/* ============================================================ */}
        {/* About                                                        */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            What is this?
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            <strong>Hologram Avatar</strong> is a repository that packages
            multiple <em>Verifiable Services</em> (VS) into a single
            deployable ecosystem. Each service runs as a Kubernetes deployment
            backed by the{" "}
            <a
              href="https://github.com/verana-labs/vs-agent"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline"
            >
              VS Agent
            </a>{" "}
            — a DIDComm-enabled agent framework — and is registered in the{" "}
            <a
              href="https://verana.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline"
            >
              Verana Network
            </a>{" "}
            Trust Registry.
          </p>
          <div className="flex items-start gap-3 rounded-xl bg-violet-50 border border-violet-200 p-4">
            <Shield className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
            <p className="text-sm text-violet-800">
              Every service in this ecosystem holds a <strong>Service
              credential</strong> issued by the Organization trust anchor,
              making its identity and permissions publicly verifiable on the
              Verana blockchain.
            </p>
          </div>
        </section>

        {/* ============================================================ */}
        {/* Services                                                     */}
        {/* ============================================================ */}
        <section id="services">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Services
          </h2>
          <p className="text-gray-600 mb-6">
            The ecosystem currently includes the following services:
          </p>

          <div className="space-y-4">
            {services.map((s) => (
              <div
                key={s.name}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}
                  >
                    <s.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {s.name}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">
                        {s.role}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{s.desc}</p>
                    {s.endpoint && (
                      <a
                        href={s.endpoint}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-sm text-violet-600 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {s.endpoint.replace("https://", "")}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* How to use                                                   */}
        {/* ============================================================ */}
        <section id="how-to-use">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            How to use
          </h2>
          <p className="text-gray-600 mb-6">
            To interact with any service in this ecosystem you need{" "}
            <strong>Hologram Messaging</strong> — a mobile wallet that manages
            your credentials and DIDComm connections.
          </p>

          <div className="space-y-4 mb-8">
            {steps.map((step) => (
              <div
                key={step.number}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {step.number}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-0.5">
                    {step.title}
                  </p>
                  <p className="text-sm text-gray-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <img
                src="https://hologram.zone/logo.svg"
                alt="Hologram Messaging"
                className="w-16 h-16 rounded-2xl shrink-0"
              />
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Download Hologram Messaging
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Available on iOS and Android. Free to use.
                </p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                  <a
                    href="https://apps.apple.com/cl/app/hologram-messaging/id6474701855"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    App Store
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=io.twentysixty.mobileagent.m"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    Google Play
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* Repository                                                   */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Repository
          </h2>
          <p className="text-gray-600 mb-4">
            Each service has its own directory with deployment configuration,
            Docker Compose for local development, and a GitHub Actions workflow
            for CI/CD.
          </p>
          <div className="rounded-xl border border-gray-200 bg-gray-900 text-gray-300 p-5 font-mono text-sm leading-relaxed overflow-x-auto">
            <pre>{`hologram-avatar/
  common/             # Shared shell helpers
  organization-vs/    # Trust anchor (workflow 1)
  avatar/             # Credential issuer chatbot (workflow 2)
  github-agent/       # GitHub AI agent with MCP (workflow 3)
  playground/         # This landing page (workflow 6)`}</pre>
          </div>
          <div className="mt-4">
            <a
              href="https://github.com/2060-io/hologram-avatar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-violet-600 hover:underline"
            >
              <Github className="w-4 h-4" />
              View on GitHub
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        <p>
          Hologram Avatar &middot; Powered by{" "}
          <a
            href="https://hologram.zone"
            className="text-violet-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Hologram
          </a>
          {" "}&amp;{" "}
          <a
            href="https://verana.io"
            className="text-violet-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Verana Network
          </a>
        </p>
      </footer>
    </div>
  );
}
