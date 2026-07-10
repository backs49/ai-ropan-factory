-- 생성 시작 여부 마커: 중복 소비(동시/새로고침) 차단 + 고착 복구 환불 근거
alter table projects add column generation_started_at timestamptz;
