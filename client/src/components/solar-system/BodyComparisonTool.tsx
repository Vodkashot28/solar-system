import { useState, useEffect, useRef } from "react";
import { type Body, BODIES } from "./bodies";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type Props = {
  initialBody?: Body;
  allBodies: Body[];
  onClose: () => void;
};

export default function BodyComparisonTool({ initialBody, allBodies, onClose }: Props) {
  const [selectedBodies, setSelectedBodies] = useState<Body[]>(
    initialBody ? [initialBody] : []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleBody = (body: Body) => {
    if (selectedBodies.find((b) => b.id === body.id)) {
      setSelectedBodies(selectedBodies.filter((b) => b.id !== body.id));
    } else if (selectedBodies.length < 4) {
      // Limit to 4 bodies for readability
      setSelectedBodies([...selectedBodies, body]);
    }
  };

  const filteredBodies = allBodies.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Normalize properties for radar chart (0-1 scale)
  const normalizeValue = (value: number, min: number, max: number) => {
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  };

  // Calculate min/max for each property across all bodies
  const allProps = allBodies.map((b) => b.properties);
  const ranges = {
    mass: { min: Math.min(...allProps.map((p) => p.mass)), max: Math.max(...allProps.map((p) => p.mass)) },
    radius: { min: Math.min(...allProps.map((p) => p.radius)), max: Math.max(...allProps.map((p) => p.radius)) },
    density: { min: Math.min(...allProps.map((p) => p.density)), max: Math.max(...allProps.map((p) => p.density)) },
    gravity: { min: Math.min(...allProps.map((p) => p.gravity)), max: Math.max(...allProps.map((p) => p.gravity)) },
    temperature: { min: Math.min(...allProps.map((p) => p.temperature)), max: Math.max(...allProps.map((p) => p.temperature)) },
    orbitalPeriod: { min: Math.min(...allProps.map((p) => p.orbitalPeriod)), max: Math.max(...allProps.map((p) => p.orbitalPeriod)) },
  };

  const radarData = {
    labels: ["Mass", "Radius", "Density", "Gravity", "Temperature", "Orbital Period"],
    datasets: selectedBodies.map((body, idx) => {
      const colors = ["#4fc3f7", "#ffb74d", "#66bb6a", "#ce93d8"];
      const color = colors[idx % colors.length];
      
      return {
        label: body.name,
        data: [
          normalizeValue(body.properties.mass, ranges.mass.min, ranges.mass.max),
          normalizeValue(body.properties.radius, ranges.radius.min, ranges.radius.max),
          normalizeValue(body.properties.density, ranges.density.min, ranges.density.max),
          normalizeValue(body.properties.gravity, ranges.gravity.min, ranges.gravity.max),
          normalizeValue(body.properties.temperature, ranges.temperature.min, ranges.temperature.max),
          normalizeValue(body.properties.orbitalPeriod, ranges.orbitalPeriod.min, ranges.orbitalPeriod.max),
        ],
        backgroundColor: `${color}33`,
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: color,
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: color,
      };
    }),
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 1,
        ticks: {
          display: false,
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        pointLabels: {
          color: "rgba(255, 255, 255, 0.7)",
          font: {
            size: 11,
          },
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "rgba(255, 255, 255, 0.8)",
          padding: 12,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "rgba(255, 255, 255, 0.2)",
        borderWidth: 1,
      },
    },
  };

  const formatValue = (value: number, unit: string) => {
    if (value === 0) return "—";
    if (Math.abs(value) < 0.01) return `${value.toExponential(2)} ${unit}`;
    if (Math.abs(value) > 10000) return `${value.toExponential(2)} ${unit}`;
    return `${value.toFixed(2)} ${unit}`;
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative w-full mx-2 my-4 sm:mx-4 max-w-6xl max-h-[95vh] overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-gray-950 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-gray-950/95 px-4 sm:px-6 py-4 backdrop-blur-md">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
              Comparison Tool
            </div>
            <div className="text-xl font-light text-white mt-0.5">
              Compare Celestial Bodies
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close comparison tool"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-base text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {/* Body Selector */}
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
              Select bodies to compare (max 4)
            </div>
            <input
              type="text"
              placeholder="Search bodies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full mb-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/40 focus:border-white/30 focus:outline-none focus:ring-0"
            />
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {filteredBodies.slice(0, 20).map((body) => {
                const isSelected = !!selectedBodies.find((b) => b.id === body.id);
                const isDisabled = !isSelected && selectedBodies.length >= 4;
                
                return (
                  <button
                    key={body.id}
                    onClick={() => !isDisabled && toggleBody(body)}
                    disabled={isDisabled}
                    className={`
                      min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-95
                      ${isSelected
                        ? "border-blue-400/50 bg-blue-400/20 text-blue-200"
                        : isDisabled
                        ? "border-white/5 bg-white/5 text-white/30 cursor-not-allowed"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      }
                    `}
                  >
                    {body.name}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedBodies.length === 0 && (
            <div className="text-center py-12 text-white/50">
              Select at least one body to start comparing
            </div>
          )}

          {selectedBodies.length > 0 && (
            <>
              {/* Radar Chart */}
              {selectedBodies.length >= 2 && (
                <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
                    Feature Comparison
                  </div>
                  <div className="h-80">
                    <Radar data={radarData} options={radarOptions} />
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                        Property
                      </th>
                      {selectedBodies.map((body) => (
                        <th
                          key={body.id}
                          className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/70"
                        >
                          {body.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="px-4 py-3 text-white/60">Type</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right text-white/80">
                          {body.type}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-white/60">Mass</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right font-mono text-white/80">
                          {formatValue(body.properties.mass, "M⊕")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-white/60">Radius</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right font-mono text-white/80">
                          {formatValue(body.properties.radius, "R⊕")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-white/60">Density</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right font-mono text-white/80">
                          {formatValue(body.properties.density, "g/cm³")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-white/60">Gravity</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right font-mono text-white/80">
                          {formatValue(body.properties.gravity, "m/s²")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-white/60">Temperature</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right font-mono text-white/80">
                          {formatValue(body.properties.temperature, "K")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-white/60">Orbital Period</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right font-mono text-white/80">
                          {formatValue(body.properties.orbitalPeriod, "days")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-white/60">Semi-Major Axis</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right font-mono text-white/80">
                          {formatValue(body.properties.semiMajorAxis, "AU")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-white/60">Eccentricity</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right font-mono text-white/80">
                          {body.properties.eccentricity.toFixed(4)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-white/60">Inclination</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right font-mono text-white/80">
                          {formatValue(body.properties.inclination, "°")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-white/60">Rotation Period</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right font-mono text-white/80">
                          {formatValue(body.properties.rotationPeriod, "hrs")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-white/60">Axial Tilt</td>
                      {selectedBodies.map((body) => (
                        <td key={body.id} className="px-4 py-3 text-right font-mono text-white/80">
                          {formatValue(body.properties.axialTilt, "°")}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
