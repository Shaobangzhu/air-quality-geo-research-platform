export function Icon({
  name,
  className = '',
}: {
  name: string;
  className?: string;
}) {
  const paths: Record<string, string> = {
    map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16',
    chart: 'M4 3v17h17M8 15l4-5 4 3 5-7',
    fire: 'M13 3c1 5-5 6-3 10 2-1 3-3 3-3 5 4 6 6 4 9-3 4-11 2-11-3 0-4 3-6 3-6s-1 5 1 5',
    layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
    pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0ZM12 7v6m-3-3h6',
    mountain: 'm2 18 6-10 4 5 4-9 6 14M2 21c5-5 7 2 12-1s5 2 8 0',
    close: 'm6 6 12 12M6 18 18 6',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    info: 'M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  };
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.info} />
    </svg>
  );
}
