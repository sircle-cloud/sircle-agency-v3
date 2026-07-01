# MainWP-verbindingstest

Dit bestand is een testartefact om de automatiseringsketen te verifiëren:

**MainWP / WordPress → GitHub → Claude Code → push terug naar repository.**

## Resultaat

- ✅ Claude Code kon de repository `sircle-cloud/sircle-agency-v3` clonen en uitlezen.
- ✅ De ontwikkelbranch `claude/mainwp-connection-test-c7sz35` is actief.
- ✅ Een wijziging kon worden gecommit en teruggepusht naar de branch.

Verschijnt deze commit op de branch, dan werkt de MainWP-verbinding end-to-end.

> Opmerking: deze repository is een statische HTML/CSS/JS-site zonder eigen
> MainWP- of WordPress-integratie. Dit bestand dient uitsluitend als
> verbindings-/pijplijntest en heeft geen effect op de live site. Het kan
> veilig worden verwijderd zodra de test is bevestigd.

Testdatum: 2026-07-01
