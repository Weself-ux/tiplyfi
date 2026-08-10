import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useAsyncError,
  useLocation,
  useRouteError,
} from 'react-router';

import { useButton } from '@react-aria/button';
import {
  type CSSProperties,
  Component,
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import './global.css';

import fetch from '@/__create/fetch';
import { useNavigate } from 'react-router';
import { serializeError } from 'serialize-error';
import { Toaster, toast } from 'sonner';

export const links = () => [];

if (globalThis.window && globalThis.window !== undefined) {
  globalThis.window.fetch = fetch;
}

function InternalErrorBoundary({ error: errorArg }: Route.ErrorBoundaryProps) {
  const routeError = useRouteError();
  const asyncError = useAsyncError();
  const error = errorArg ?? asyncError ?? routeError;
  const [isOpen, setIsOpen] = useState(false);
  const shouldScale = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  const scaleFactor = shouldScale ? 1.02 : 1;
  const copyButtonTextClass = shouldScale ? 'text-sm' : 'text-xs';
  const copyButtonPaddingClass = shouldScale ? 'px-[10px] py-[5px]' : 'px-[6px] py-[3px]';
  const postCountRef = useRef(0);
  const lastPostTimeRef = useRef(0);
  const lastErrorKeyRef = useRef<string | null>(null);
  const MAX_ERROR_POSTS_PER_ERROR = 5;
  const THROTTLE_MS = 1000;

  useEffect(() => {
    const serialized = serializeError(error);
    const errorKey = JSON.stringify(serialized);

    // Reset the counter when a genuinely different error arrives
    if (errorKey !== lastErrorKeyRef.current) {
      lastErrorKeyRef.current = errorKey;
      postCountRef.current = 0;
    }

    if (postCountRef.current >= MAX_ERROR_POSTS_PER_ERROR) {
      return;
    }

    const now = Date.now();
    const timeSinceLastPost = now - lastPostTimeRef.current;

    const post = () => {
      if (postCountRef.current >= MAX_ERROR_POSTS_PER_ERROR) {
        return;
      }
      postCountRef.current += 1;
      lastPostTimeRef.current = Date.now();
      window.parent.postMessage({ type: 'sandbox:error:detected', error: serialized }, '*');
    };

    if (timeSinceLastPost < THROTTLE_MS) {
      const timer = setTimeout(post, THROTTLE_MS - timeSinceLastPost);
      return () => clearTimeout(timer);
    }

    post();
  }, [error]);

  useEffect(() => {
    const animateTimer = setTimeout(() => setIsOpen(true), 100);
    return () => clearTimeout(animateTimer);
  }, []);
  const { buttonProps: copyButtonProps } = useButton(
    {
      onPress: useCallback(() => {
        const toastScale = shouldScale ? 1.2 : 1;
        const toastStyle = {
          padding: `${16 * toastScale}px`,
          background: '#18191B',
          border: '1px solid #2C2D2F',
          color: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          width: `${280 * toastScale}px`,
          fontSize: `${13 * toastScale}px`,
          display: 'flex',
          alignItems: 'center',
          gap: `${6 * toastScale}px`,
          justifyContent: 'flex-start',
          margin: '0 auto',
        };
        navigator.clipboard.writeText(JSON.stringify(serializeError(error)));
        toast.custom(
          () => (
            <div style={toastStyle}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                height="20"
                width="20"
              >
                <title>Success</title>
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Copied successfully!</span>
            </div>
          ),
          {
            id: 'copy-error-success',
            duration: 3000,
          }
        );
      }, [error, shouldScale]),
    },
    useRef<HTMLButtonElement>(null)
  );

  function isInIframe() {
    try {
      return window.parent !== window;
    } catch {
      return true;
    }
  }
  return (
    <>
      {!isInIframe() && (
        <div
          className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 max-w-md z-50 transition-all duration-500 ease-out ${
            isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
          style={{ width: '75vw' }}
        >
          <div
            className="bg-[#18191B] text-[#F2F2F2] rounded-lg p-4 shadow-lg w-full"
            style={
              scaleFactor !== 1
                ? ({
                    transform: `scale(${scaleFactor})`,
                    transformOrigin: 'bottom center',
                  } as CSSProperties)
                : undefined
            }
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-[#F2F2F2] rounded-full flex items-center justify-center">
                  <span className="text-black text-[1.125rem] leading-none">!</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <div className="flex flex-col gap-1">
                  <p className="font-light text-[#F2F2F2] text-sm">App Error Detected</p>
                  <p className="text-[#959697] text-sm font-light">
                    It looks like an error occurred while trying to use your app.
                  </p>
                </div>

                <button
                  className={`flex flex-row items-center justify-center gap-[4px] outline-none transition-colors rounded-[8px] border-[1px] bg-[#2C2D2F] hover:bg-[#414243] active:bg-[#555658] border-[#414243] text-white ${copyButtonTextClass} ${copyButtonPaddingClass} w-fit`}
                  type="button"
                  {...copyButtonProps}
                >
                  Copy error
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = { hasError: boolean; error: unknown | null };

class ErrorBoundaryWrapper extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error(error, info);
  }

  render() {
    if (this.state.hasError) {
      return <InternalErrorBoundary error={this.state.error} params={{}} />;
    }
    return this.props.children;
  }
}

function LoaderWrapper({ loader }: { loader: () => React.ReactNode }) {
  return <>{loader()}</>;
}

type ClientOnlyProps = {
  loader: () => React.ReactNode;
};

export const ClientOnly: React.FC<ClientOnlyProps> = ({ loader }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ErrorBoundaryWrapper sits outside the isMounted gate so it commits on
  // the first (empty) render and is a stable ancestor by the time children
  // mount. Catastrophic errors (e.g. stack overflow in user code) can blow
  // the call stack before React commits a boundary mounted in the same pass
  // as the throwing child; keeping the boundary always-mounted avoids that.
  return (
    <ErrorBoundaryWrapper>
      {isMounted ? <LoaderWrapper loader={loader} /> : null}
    </ErrorBoundaryWrapper>
  );
};

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location?.pathname;
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'sandbox:navigation') {
        navigate(event.data.pathname);
      }
    };
    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'sandbox:web:ready' }, '*');
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [navigate]);

  useEffect(() => {
    if (pathname) {
      window.parent.postMessage(
        {
          type: 'sandbox:web:navigation',
          pathname,
        },
        '*'
      );
    }
  }, [pathname]);
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <ClientOnly loader={() => children} />
        <Toaster position={isMobile ? 'top-center' : 'bottom-right'} />
        <ScrollRestoration />
        <Scripts />
        <link rel="preconnect" href="https://ka-p.fontawesome.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://ka-p.fontawesome.com/releases/v6.3.0/css/pro.min.css?token=2c15cc0cc7" crossOrigin="anonymous" />
      </body>
    </html>
  );
}

export const ErrorBoundary = InternalErrorBoundary;

export default function App() {
  return <Outlet />;
}
