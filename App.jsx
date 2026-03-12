import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { STATIONS } from "./data/stations";
import { TRAINS } from "./data/trains";
import { STOP_TIMES } from "./data/stopTimes";

function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getNowHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function stationNameById(stationId) {
  return STATIONS.find((s) => s.station_id === stationId)?.station_name ?? stationId;
}

function buildCandidateTrains(originStationId, destinationStationId) {
  const originStops = STOP_TIMES.filter((row) => row.station_id === originStationId);
  const destinationStops = STOP_TIMES.filter((row) => row.station_id === destinationStationId);

  const destinationMap = new Map();
  for (const row of destinationStops) {
    destinationMap.set(row.train_id, row);
  }

  const candidates = [];

  for (const originRow of originStops) {
    const destinationRow = destinationMap.get(originRow.train_id);
    if (!destinationRow) continue;

    if (originRow.stop_order >= destinationRow.stop_order) continue;
    if (!originRow.dep_time) continue;
    if (!destinationRow.arr_time) continue;

    const trainInfo = TRAINS.find((t) => t.train_id === originRow.train_id);
    if (!trainInfo) continue;

    candidates.push({
      train_id: originRow.train_id,
      origin_station_id: originStationId,
      destination_station_id: destinationStationId,
      depart: originRow.dep_time,
      arrive: destinationRow.arr_time,
      train_type: trainInfo.train_type,
      destination: trainInfo.destination,
      direction: trainInfo.direction,
    });
  }

  return candidates.sort((a, b) => timeToMinutes(a.depart) - timeToMinutes(b.depart));
}

function pickBestAndNeighbors(candidates, nowHHMM) {
  if (candidates.length === 0) {
    return { best: null, list: [] };
  }

  const baseMinutes = timeToMinutes(nowHHMM) - 3;

  let bestIndex = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const departMinutes = timeToMinutes(candidates[i].depart);
    const diff = Math.abs(departMinutes - baseMinutes);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  const prev = candidates[bestIndex - 1];
  const best = candidates[bestIndex];
  const next = candidates[bestIndex + 1];

  const list = [prev, best, next].filter(Boolean);

  return { best, list };
}

function App() {
  const [originStationId, setOriginStationId] = useState("shingu_chuo");
  const [destinationStationId, setDestinationStationId] = useState("hakata");
  const [nowHHMM, setNowHHMM] = useState(getNowHHMM());
  const [selectedTrainId, setSelectedTrainId] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowHHMM(getNowHHMM());
    }, 1000 * 30);

    return () => clearInterval(timer);
  }, []);

  const allCandidates = useMemo(() => {
    if (originStationId === destinationStationId) return [];
    return buildCandidateTrains(originStationId, destinationStationId);
  }, [originStationId, destinationStationId]);

  const { best, list } = useMemo(() => {
    return pickBestAndNeighbors(allCandidates, nowHHMM);
  }, [allCandidates, nowHHMM]);

  const selectedTrain = useMemo(() => {
    if (!list.length) return null;
    return list.find((t) => t.train_id === selectedTrainId) ?? best ?? list[0];
  }, [list, best, selectedTrainId]);

  const remainingMinutes = useMemo(() => {
    if (!selectedTrain) return null;
    const diff = timeToMinutes(selectedTrain.arrive) - timeToMinutes(nowHHMM);
    return diff;
  }, [selectedTrain, nowHHMM]);

  return (
    <div className="app">
      <div className="container">
        <h1>乗り過ごし防止アプリ MVP</h1>
        <p className="lead">
          出発駅と到着駅を選ぶと、現在時刻の3分前を基準にいちばん近い候補を表示します。
        </p>

        <div className="panel">
          <h2>検索条件</h2>

          <div className="form-grid">
            <label>
              出発駅
              <select value={originStationId} onChange={(e) => setOriginStationId(e.target.value)}>
                {STATIONS.map((station) => (
                  <option key={station.station_id} value={station.station_id}>
                    {station.station_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              到着駅
              <select value={destinationStationId} onChange={(e) => setDestinationStationId(e.target.value)}>
                {STATIONS.map((station) => (
                  <option key={station.station_id} value={station.station_id}>
                    {station.station_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="now-box">
            現在時刻: <strong>{nowHHMM}</strong>
            <span className="sub">（判定基準は3分前）</span>
          </div>
        </div>

        <div className="panel">
          <h2>到着確認</h2>

          {originStationId === destinationStationId ? (
            <div className="message">出発駅と到着駅が同じです。</div>
          ) : !selectedTrain ? (
            <div className="message">候補がありません。</div>
          ) : (
            <div className="main-card">
              <div className="route-line">
                {stationNameById(originStationId)} → {stationNameById(destinationStationId)}
              </div>

              <div className="train-meta">
                <span>{selectedTrain.depart}発</span>
                <span>{selectedTrain.train_type}</span>
                <span>{selectedTrain.destination}行</span>
                <span>列車番号: {selectedTrain.train_id}</span>
              </div>

              <div className="big-time">
                到着時刻: {selectedTrain.arrive}
              </div>

              <div className="big-remaining">
                {remainingMinutes != null ? (
                  remainingMinutes >= 0 ? (
                    <>あと {remainingMinutes} 分</>
                  ) : (
                    <>到着時刻を {Math.abs(remainingMinutes)} 分過ぎています</>
                  )
                ) : null}
              </div>
            </div>
          )}

          <h3>候補一覧</h3>

          <div className="candidate-list">
            {list.length === 0 ? (
              <div className="message small">表示できる候補がありません。</div>
            ) : (
              list.map((train) => (
                <button
                  key={train.train_id}
                  className={`candidate-button ${selectedTrain?.train_id === train.train_id ? "selected" : ""}`}
                  onClick={() => setSelectedTrainId(train.train_id)}
                >
                  <div className="candidate-top">
                    <span>{train.depart}発</span>
                    <span>{train.train_type}</span>
                    <span>{train.destination}行</span>
                  </div>
                  <div className="candidate-bottom">
                    到着 {train.arrive} / 列車番号 {train.train_id}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;