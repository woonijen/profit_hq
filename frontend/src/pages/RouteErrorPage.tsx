import { isRouteErrorResponse, useRouteError } from 'react-router';

export function RouteErrorPage() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';

  return (
    <div role="alert" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-slate-600">{message}</p>
      <a href="/" className="mt-4 inline-block text-sm font-medium text-emerald-700 underline">
        Go back home
      </a>
    </div>
  );
}
