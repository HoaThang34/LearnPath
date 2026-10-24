import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export const ACADEMIC_SUBJECTS = [
  'Toán',
  'Ngữ văn',
  'Tiếng Anh',
  'Vật lý',
  'Hóa học',
  'Sinh học',
  'Lịch sử',
  'Địa lí',
  'Tin học',
  'Công nghệ',
  'Giáo dục kinh tế và pháp luật',
]

export const ACADEMIC_TERMS = ['Kỳ 1', 'Kỳ 2', 'Cả năm']
export const ACADEMIC_CLASS_LEVELS = ['10', '11', '12']

export function inferAcademicClassLevel(profileClass, scores = []) {
  const storedLevel = scores.find((item) => ACADEMIC_CLASS_LEVELS.includes(String(item.lop)))?.lop
  if (storedLevel) return String(storedLevel)
  const match = String(profileClass || '').match(/(?:^|\D)(10|11|12)(?=\D|$)/)
  return match ? match[1] : '10'
}

export function inferAcademicTerm(scores = []) {
  return ACADEMIC_TERMS.find((term) => scores.some((item) => item.ky_hoc === term)) || 'Kỳ 1'
}

export default function AcademicScoresEditor({
  scores = [],
  onChange,
  classLevel,
  onClassLevelChange,
  term,
  onTermChange,
}) {
  const getValue = (subject) => scores.find((item) =>
    item.mon === subject && String(item.lop) === String(classLevel) && item.ky_hoc === term
  )?.diem ?? ''

  const updateValue = (subject, rawValue) => {
    const remaining = scores.filter((item) => !(
      item.mon === subject && String(item.lop) === String(classLevel) && item.ky_hoc === term
    ))
    if (rawValue === '') {
      onChange(remaining)
      return
    }
    onChange([...remaining, {
      mon: subject,
      lop: String(classLevel),
      ky_hoc: term,
      loai_diem: 'average',
      diem: rawValue,
    }])
  }

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="academic-class-level">Lớp</Label>
        <select id="academic-class-level" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={classLevel} onChange={(event) => onClassLevelChange(event.target.value)}>
          {ACADEMIC_CLASS_LEVELS.map((level) => <option key={level} value={level}>Lớp {level}</option>)}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="academic-term">Loại điểm trung bình</Label>
        <select id="academic-term" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={term} onChange={(event) => onTermChange(event.target.value)}>
          <option value="Kỳ 1">Trung bình học kỳ 1</option>
          <option value="Kỳ 2">Trung bình học kỳ 2</option>
          <option value="Cả năm">Trung bình cả năm</option>
        </select>
      </div>
    </div>
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {ACADEMIC_SUBJECTS.map((subject) => (
        <div className="space-y-1.5" key={subject}>
          <Label htmlFor={`academic-score-${subject}`}>{subject}</Label>
          <Input
            id={`academic-score-${subject}`}
            type="number"
            min="0"
            max="10"
            step="0.01"
            inputMode="decimal"
            placeholder="0 - 10"
            value={getValue(subject)}
            onChange={(event) => updateValue(subject, event.target.value)}
          />
        </div>
      ))}
    </div>
  </div>
}
