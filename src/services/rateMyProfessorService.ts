export type RateMyProfessorRating = {
  totalRating: number; // 1-5
  ratingCount: number; // number of ratings
};

type LookupResponse =
  | { ok: true; rating: RateMyProfessorRating }
  | { ok: false; error: string };

const endpoint =
  process.env.EXPO_PUBLIC_RATE_MY_PROFESSOR_API ||
  process.env.EXPO_PUBLIC_RMP_API ||
  'http://localhost:3001/api/ratemyprofessor/lookup';

export class RateMyProfessorService {
  static async lookupProfessorRating(
    params: { universityName: string; professorName: string }
  ): Promise<RateMyProfessorRating | null> {
    const { universityName, professorName } = params;
    if (!universityName.trim() || !professorName.trim()) return null;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        universityName: universityName.trim(),
        professorName: professorName.trim(),
      }),
    });

    if (!res.ok) {
      let message = `Request failed with status ${res.status}`;
      try {
        const data = await res.json();
        if (data?.error) message = String(data.error);
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const data = (await res.json()) as LookupResponse;
    if (!data.ok) return null;
    return data.rating;
  }
}

