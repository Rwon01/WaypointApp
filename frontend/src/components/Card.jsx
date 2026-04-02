export default function Card({ children, className }) {
  return <div className={`border p-2 flex justify-between ${className}`}>{children}</div>;
}

export function CardContent({ children, className }) {
  return <div className={`${className}`}>{children}</div>;
}