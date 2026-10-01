// A retired address that sends visitors on to its replacement. The site is static, so the move happens in the
// browser: a refresh tag for any client and an immediate replace for scripts; the link covers everything else.
export function Redirect({ to }: { to: string }) {
  return <>
    <meta httpEquiv="refresh" content={`0; url=${to}`}/>
    <script dangerouslySetInnerHTML={{ __html: `location.replace(${JSON.stringify(to)}+location.hash)` }}/>
    <p><a href={to}>VELMREN</a></p>
  </>;
}
