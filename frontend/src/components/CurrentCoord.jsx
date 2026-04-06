export default function CurrentCoord({ coords }) {
  return (
    <div className="absolute bottom-0 left-0 m-4 text-xl bg-black/50 text-white p-2 rounded">
      X: {coords.x} Z: {coords.z}
    </div>
  );
}