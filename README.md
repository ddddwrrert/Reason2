# Reason2

**Independent** claim-guided evolutionary arm (fork of [Reason](https://github.com/ddddwrrert/Reason)).

Adds what Reason left as stubs:

- **Real locus** from solution diffs / edit themes  
- **Executable \(R^+/R^-\)** text (do / don鈥檛)  
- **Tip holdout** (pending 鈫?retest 鈫?promote / reject)  
- **Config** (`explore_rate`, starve, R卤 caps / decay)  
- **Same-\(B\) A/B** script + **event replay**  
- Claim-aware offline worker (still mock \(V\); DSH LLM optional)

Standalone clone-and-run 鈥?**no Organon / Reason runtime dependency**. Optional `DSH_EVOLVE_REASON2=1`.

## Loop

```text
loadConfig
  鈫?chooseArm (exploit|explore + anti-starve)
  鈫?plan locus + executable claim plan
  鈫?select 鈫?mutate(claim) 鈫?evaluate (sealed)
  鈫?diff themes 鈫?attribute (R+/R-/tip holdout)
  鈫?survive 鈫?report.json
```

## Offline

```bash
npm install
npm test
npm start
npm run ab          # baseline vs reason2, same B
npm run replay -- --run ./run --last
```

## Honest boundary

Runnable control flow + mock A/B 鈮?AHC tip proof. Contest claims need official \(V\) and fixed \(B\).

## Layout

```text
src/claim/{diff,locus,config,gate,ledger,attribute,prompt,...}
src/providers/{claim-loop,claim-select,claim-mutate}
bin/{reason2-run,ab-compare,replay-event}.js
```
