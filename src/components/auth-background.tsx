import Image from "next/image";

interface AuthBackgroundProps {
  children: React.ReactNode;
  overlayOpacity?: number;
}

export function AuthBackground({ children, overlayOpacity = 0.5 }: AuthBackgroundProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background image layer */}
      <div className="fixed inset-0 -z-20">
        <Image
          src="/images/auth-bg.jpg"
          alt=""
          fill
          preload
          className="object-cover"
          sizes="100vw"
          quality={85}
        />
      </div>

      {/* Dark overlay layer */}
      <div
        className="fixed inset-0 -z-10"
        style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
      />

      {/* Content layer */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}

export default AuthBackground;
