"use client";

import { useState } from "react";
import {
  Smartphone,
  ExternalLink,
  ArrowDown,
  Shield,
  Bot,
  KeyRound,
  QrCode,
  X,
  Github,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Service data                                                       */
/* ------------------------------------------------------------------ */

const services = [
  {
    id: "organization",
    name: "Organization",
    role: "Trust Anchor",
    desc: "The root of trust for this ecosystem. It registers with the Verana Network as a verified organization, creates a Trust Registry with a custom credential schema, and issues Service credentials to child services. All other services in this ecosystem derive their trust from this anchor.",
    logoUrl: "https://2060.io/images/logo-squared.svg",
    borderColor: "border-amber-200",
    endpoint: null,
  },
  {
    id: "avatar",
    name: "Avatar",
    role: "Credential Issuer Chatbot",
    desc: "A DIDComm chatbot that issues verifiable credentials to users through conversational interactions. Connect with Hologram Messaging, follow the guided flow, and receive a W3C Verifiable Credential backed by the Verana Trust Registry. Your credential proves attributes about you and can be verified by any party.",
    logoUrl: "https://2060.io/images/avatar.jpg",
    borderColor: "border-violet-200",
    endpoint: "https://avatar.vs.hologram.zone",
  },
  {
    id: "passport",
    name: "Passport Issuer",
    role: "Credential Issuer (NFC + Liveness)",
    desc: "A credential issuer that reads NFC data from government-issued identity documents (passports, ID cards) and verifies the holder's identity via a liveness check with video call and gesture detection. Once verified, it issues a passport credential as a W3C Verifiable Credential backed by the Verana Trust Registry.",
    logoUrl: "https://hologram.zone/images/passport.jpg",
    borderColor: "border-blue-200",
    endpoint: "https://passport.vs.hologram.zone",
  },
  {
    id: "github-agent",
    name: "GitHub Agent",
    role: "AI Agent with MCP",
    desc: "An AI-powered GitHub assistant that uses the Model Context Protocol (MCP) to interact with GitHub on your behalf. Search repositories, browse issues and pull requests, explore code, and manage your projects — all through an encrypted DIDComm chat in Hologram Messaging. To get started: first authenticate using the credential you received from the Avatar service, then open the contextual menu, select \"MCP Server Config\", and enter your GitHub Personal Access Token. Once configured, the agent can access GitHub tools on your behalf.",
    logoUrl: "https://hologram.zone/images/github.svg",
    borderColor: "border-gray-200",
    endpoint: "https://github-agent.vs.hologram.zone",
  },
  {
    id: "wise-agent",
    name: "Wise Agent",
    role: "AI Agent with MCP",
    desc: "An AI-powered Wise assistant that uses the Model Context Protocol (MCP) to interact with your Wise account. Check balances, view exchange rates, list transfers, send money, create invoices, and manage recipients — all through an encrypted DIDComm chat in Hologram Messaging. To get started: first authenticate using the credential you received from the Avatar service, then open the contextual menu, select \"MCP Server Config\", and enter your Wise API Token. Once configured, the agent can access Wise tools on your behalf.",
    logoUrl: "https://hologram.zone/images/wise.svg",
    borderColor: "border-green-200",
    endpoint: "https://wise-agent.vs.hologram.zone",
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
    desc: "Tap \"Show QR Code\" on any service card below, then scan it with Hologram Messaging to establish an encrypted DIDComm connection.",
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
/*  Service Card                                                       */
/* ------------------------------------------------------------------ */

function ServiceCard({
  service,
}: {
  service: (typeof services)[number];
}) {
  const [showQr, setShowQr] = useState(false);

  return (
    <div
      className={`rounded-2xl border ${service.borderColor} bg-white shadow-sm overflow-hidden`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <img
            src={service.logoUrl}
            alt={service.name}
            className="w-12 h-12 rounded-xl shrink-0 object-cover"
          />
          <div>
            <h3 className="text-lg font-bold text-gray-900">{service.name}</h3>
            <span className="text-sm text-gray-400 font-medium">
              {service.role}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          {service.desc}
        </p>

        {/* Actions */}
        {service.endpoint && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowQr(!showQr)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                showQr
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "bg-violet-600 text-white hover:bg-violet-700"
              }`}
            >
              {showQr ? (
                <>
                  <X className="w-4 h-4" /> Hide QR Code
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4" /> Connect with Hologram
                </>
              )}
            </button>
            <a
              href={service.endpoint}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {service.endpoint.replace("https://", "")}
            </a>
          </div>
        )}

        {!service.endpoint && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              This is the trust anchor — it has no public-facing chatbot.
              It operates in the background, issuing credentials to the
              services below.
            </p>
          </div>
        )}
      </div>

      {/* QR Code panel */}
      {showQr && service.endpoint && (
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-6">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <img
                src={`${service.endpoint}/qr`}
                alt={`QR code for ${service.name}`}
                width={200}
                height={200}
              />
            </div>
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Scan with{" "}
              <strong className="text-gray-600">Hologram Messaging</strong> to
              establish an encrypted DIDComm connection with this service.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

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
            Hologram Verifiable Services
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
        {/* Services                                                     */}
        {/* ============================================================ */}
        <section id="services">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Services
          </h2>
          <p className="text-gray-600 mb-6">
            This ecosystem includes the following services. Connect to any
            of them using{" "}
            <a
              href="#get-hologram"
              className="text-violet-600 hover:underline font-medium"
            >
              Hologram Messaging
            </a>
            .
          </p>

          <div className="space-y-6">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} />
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

          <div
            id="get-hologram"
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
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
            <pre>{`hologram-verifiable-services/
  common/               # Shared shell helpers
  organization/         # Trust anchor (workflow 1)
  avatar/               # Credential issuer chatbot (workflow 2)
  github-agent/         # GitHub AI agent with MCP (workflow 3)
  wise-agent/           # Wise AI agent with MCP (workflow 4)
  passport/             # Passport credential issuer (workflow 5)
  playground/           # This landing page (workflow 6)`}</pre>
          </div>
          <div className="mt-4">
            <a
              href="https://github.com/2060-io/hologram-verifiable-services"
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
          Hologram Verifiable Services &middot; Powered by{" "}
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
