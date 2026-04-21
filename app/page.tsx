import Link from "next/link";

export default function LandingPage() {
  const features = [
    { icon: "💪", title: "Log Workouts", desc: "Track every rep, set, and PR" },
    { icon: "🥗", title: "Track Nutrition", desc: "Log meals and hit your macros" },
    { icon: "🏆", title: "Compete", desc: "Join challenges, earn badges" },
    { icon: "🤝", title: "Connect", desc: "Follow athletes, share progress" },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 50%, #FF8C42 100%)" }}>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20"
          style={{ background: "rgba(255,255,255,0.3)" }} />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: "rgba(255,255,255,0.4)" }} />
        <div className="absolute top-1/3 left-10 w-20 h-20 rounded-full opacity-15"
          style={{ background: "rgba(255,255,255,0.5)" }} />
      </div>

      <div className="relative z-10 flex flex-col items-center px-6 py-12 max-w-sm w-full mx-auto">

        {/* Logo */}
        <div className="mb-3 text-center">
          <div className="text-9xl font-black text-white tracking-tighter leading-none drop-shadow-lg">
            FIT
          </div>
          <div className="text-5xl -mt-2">💪</div>
        </div>

        {/* Tagline */}
        <p className="text-white text-xl font-semibold mb-2 tracking-wide text-center">
          Track. Connect. Compete.
        </p>
        <p className="text-orange-100 text-sm text-center mb-10">
          The fitness social app built for people who show up.
        </p>

        {/* Features */}
        <div className="w-full grid grid-cols-2 gap-3 mb-10">
          {features.map((f) => (
            <div key={f.title}
              className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-4 border border-white border-opacity-30">
              <div className="text-2xl mb-1">{f.icon}</div>
              <div className="text-white font-bold text-sm">{f.title}</div>
              <div className="text-orange-100 text-xs mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link href="/signup"
          className="w-full py-4 rounded-2xl font-bold text-lg text-center transition-all duration-200 active:scale-95 shadow-lg"
          style={{ background: "#FFFFFF", color: "#7C3AED" }}>
          Get Started · It&apos;s Free
        </Link>

        <p className="mt-4 text-orange-100 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-white font-semibold underline underline-offset-2">
            Sign In
          </Link>
        </p>

        {/* Social proof */}
        <div className="mt-10 flex items-center gap-2">
          <div className="flex -space-x-2">
            {["JM", "SC", "MD", "LF"].map((init, i) => (
              <div key={i}
                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                style={{ background: i % 2 === 0 ? "#7C3AED" : "#A78BFA", opacity: 0.9 - i * 0.1 }}>
                {init}
              </div>
            ))}
          </div>
          <p className="text-orange-100 text-xs">
            <span className="text-white font-semibold">2,400+ athletes</span> already crushing it
          </p>
        </div>
      </div>
    </div>
  );
}


