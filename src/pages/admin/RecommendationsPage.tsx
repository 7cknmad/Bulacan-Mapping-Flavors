import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { assetUrl } from '../../utils/assets';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Spinner } from '../../components/ui/spinner';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3002';

async function getJSON(url: string) {
  const res = await fetch(url);
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt);
}

export default function RecommendationsPage() {
  const navigate = useNavigate();
  const [municipalities, setMunicipalities] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMuni, setSelectedMuni] = useState<number | null>(null);
  const [dishes, setDishes] = useState<any[] | null>(null);
  const [currentRec, setCurrentRec] = useState<any | null>(null);
  const [topRatedDishes, setTopRatedDishes] = useState<any[] | null>(null);
  const [selectedDish, setSelectedDish] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getJSON(`${API}/api/municipalities`);
        if (canceled) return;
        // Transform data to include OSM IDs
        const processed = (Array.isArray(data) ? data : (data?.rows ?? data)).map((m: any) => ({
          ...m,
          id: m.osm_relation_id || m.osm_id || m.id // Prefer OSM IDs
        }));
        setMunicipalities(processed);
      } catch (e: any) {
        if (!canceled) setError(String(e?.message || e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, []);

  useEffect(() => {
    if (!selectedMuni) {
      setDishes(null);
      setCurrentRec(null);
      setTopRatedDishes(null);
      setSelectedDish(null);
      return;
    }
    let canceled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const ds = await getJSON(`${API}/api/dishes?municipalityId=${selectedMuni}&limit=200`);
        if (canceled) return;
        setDishes(Array.isArray(ds) ? ds : (ds?.rows ?? ds));
        
        const summary = await getJSON(`${API}/api/municipalities/${selectedMuni}/dishes-summary`);
        if (canceled) return;
        setCurrentRec(summary?.recommendedDish ?? null);
        setTopRatedDishes(summary?.topRatedDishes ?? []);
        setSelectedDish(summary?.recommendedDish?.id ?? null);
      } catch (e: any) {
        if (!canceled) setError(String(e?.message || e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [selectedMuni]);

  async function saveRecommendation() {
    if (!selectedMuni) return setError('Please pick a municipality');
    setSaving(true);
    setError(null);
    try {
      // If there's an existing recommended dish different from selected, clear it
      if (currentRec && currentRec.id && currentRec.id !== selectedDish) {
        await fetch(`${API}/admin/curate/dishes/${currentRec.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ panel_rank: 0 })
        });
      }

      if (selectedDish) {
        await fetch(`${API}/admin/curate/dishes/${selectedDish}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ panel_rank: 1 })
        });
      }

      // Notify other UI
      try {
        window.dispatchEvent(new CustomEvent('dish-curation-updated', { 
          detail: { municipalityId: selectedMuni, dishId: selectedDish }
        }));
      } catch (e) {}

      // Refresh local state
      const summary = await getJSON(`${API}/api/municipalities/${selectedMuni}/dishes-summary`);
      setCurrentRec(summary?.recommendedDish ?? null);
      setTopRatedDishes(summary?.topRatedDishes ?? []);
      setSelectedDish(summary?.recommendedDish?.id ?? null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !municipalities) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dish Recommendations</h1>
        <Button variant="outline" onClick={() => navigate('/admin')}>Back to Dashboard</Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Municipality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Municipality</Label>
                <Select
                  className="w-full"
                  value={selectedMuni ?? ''}
                  onChange={(e) => setSelectedMuni(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select municipality</option>
                  {(municipalities ?? []).map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>

              {currentRec && (
                <div>
                  <Label>Current Recommended Dish</Label>
                  <div className="p-4 border rounded-lg mt-2">
                    <div className="flex items-center gap-4">
                      <img
                        src={currentRec.image_url ? (currentRec.image_url.startsWith('http') ? currentRec.image_url : assetUrl(currentRec.image_url)) : assetUrl('images/placeholders/dish.jpg')}
                        alt={currentRec.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div>
                        <div className="font-semibold">{currentRec.name}</div>
                        <div className="text-sm text-muted-foreground">ID: {currentRec.id}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Rated Dishes</CardTitle>
          </CardHeader>
          <CardContent>
            {topRatedDishes && topRatedDishes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Dish</TableHead>
                    <TableHead>Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topRatedDishes.map((dish, index) => (
                    <TableRow key={dish.id}>
                      <TableCell>#{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img
                            src={dish.image_url ? (dish.image_url.startsWith('http') ? dish.image_url : assetUrl(dish.image_url)) : assetUrl('images/placeholders/dish.jpg')}
                            alt={dish.name}
                            className="w-8 h-8 object-cover rounded"
                          />
                          {dish.name}
                        </div>
                      </TableCell>
                      <TableCell>{dish.avg_rating?.toFixed(1)} ⭐</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                {selectedMuni ? 'No rated dishes found' : 'Select a municipality to view top rated dishes'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedMuni && (
        <Card>
          <CardHeader>
            <CardTitle>Set Recommended Dish</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Pick Dish to Recommend</Label>
                <Select
                  className="w-full"
                  value={selectedDish ?? ''}
                  onChange={(e) => setSelectedDish(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">-- Clear recommendation --</option>
                  {(dishes ?? []).map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.avg_rating ? `· ${Number(d.avg_rating).toFixed(1)}⭐` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={saveRecommendation} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Recommendation'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}