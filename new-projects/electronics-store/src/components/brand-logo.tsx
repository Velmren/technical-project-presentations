const brandAssets: Record<string, { file: string; width: number; height: number; showName?: boolean }> = {
  Amazon: { file: 'amazon', width: 70, height: 24 },
  Apple: { file: 'apple', width: 23, height: 28 },
  ASUS: { file: 'asus', width: 68, height: 22 },
  Beats: { file: 'beats', width: 25, height: 25 },
  Canon: { file: 'canon', width: 72, height: 24 },
  Dell: { file: 'dell', width: 29, height: 29 },
  Dyson: { file: 'dyson', width: 67, height: 26 },
  Huawei: { file: 'huawei', width: 30, height: 30 },
  iRobot: { file: 'irobot', width: 24, height: 24, showName: true },
  Lenovo: { file: 'lenovo', width: 73, height: 23 },
  Microsoft: { file: 'microsoft', width: 21, height: 21, showName: true },
  Nintendo: { file: 'nintendo', width: 82, height: 23 },
  OPPO: { file: 'oppo', width: 69, height: 23 },
  realme: { file: 'realme', width: 73, height: 24 },
  Samsung: { file: 'samsung', width: 87, height: 23 },
  Sony: { file: 'sony', width: 65, height: 23 },
  Valve: { file: 'valve', width: 71, height: 24 },
  vivo: { file: 'vivo', width: 58, height: 23 },
};

/** Genuine local brand artwork; unknown brands remain readable text. */
export function BrandLogo({ brand, className = '' }: { brand: string; className?: string }) {
  const asset = brandAssets[brand];

  if (!asset) return <span className={`brand-logo brand-logo--text ${className}`}>{brand}</span>;

  return (
    <span className={`brand-logo brand-logo--${asset.file} ${className}`} role="img" aria-label={brand} title={brand}>
      <img
        src={`/brands/${asset.file}.svg`}
        alt=""
        width={asset.width}
        height={asset.height}
        style={{ objectFit: 'contain' }}
        draggable={false}
      />
      {asset.showName && <span aria-hidden="true">{brand}</span>}
    </span>
  );
}
