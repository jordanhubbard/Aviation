# Native service-health qualification

- **Status:** partial
- **Owning tracker:** [#442](https://github.com/jordanhubbard/Aviation/issues/442)
- **Completion / archival evidence:** library qualification below; importer and production cutover pending

The registered native child at `.literate/native-projects/local-service-health`
was rebound through the official reviewed Standard lifecycle plan to the released
Literate AI 1.3.0 distribution identity
`05c61ad4fc9e3e78e6dd4510f5d1170a844efab3478168883035f7196aec9a8a`.
The child registration changed atomically, preserving the historical initialization
origin and qualification projection history. No distribution pin was edited by hand.

A forced fresh ordinary Standard rebuild passed 20 generated tests with no repairs.
That current child receipt is
`sha256:018aa2107bcf1608df5ade146079097aa252a0c87aa03f2f49a30e4a56e58799`.
A separate `spec qualify --recertify-current-qualified` run produced two clean
implementations. Both passed all 19 independently owned parity cases by case identity;
their generated unit suites contained 21 and 26 cases respectively. These counts are
separate evidence sets and must not be conflated.

The [qualification record](../verification/qualifications/service-health-20261116.json)
binds current Component lock, baseline, all case identities, both runs and retained
content-addressed evidence. Its qualification decision is
`sha256:013d2feabe0c11f639a9c912565178c069be12b1c09127da690965d177622ff8`;
current child authority projection is
`sha256:10ebef4a33acb04302eab2b80b820ead42789c2efc51961d1c7546097ae4c805`.
Independent review verified all 346 retained archive records, archive size/digest,
case/source bindings, current projection and preserved prior history.

## Remaining importer boundary

A separate qualification-only JavaScript consumer declared the direct generation
edge and exact public library interface and reused the 19 oracle cases. Its ordinary
composed rebuild was rejected before acceptance: the generated importer declared an
npm dependency without an explicitly selected package-npm target. This failed probe
is retained privately and confers no importer admission. Independent source review found that typed library bindings are validated but the
default JavaScript consumer builder supplies no public package/module mapping. The
pinned generation guidance also restricts non-npm code to Node built-ins. This is an
inferred framework integration gap, tracked as
[literate-ai#447](https://github.com/jordanhubbard/literate-ai/issues/447), separate
from the actual observed dependency rejection. No runtime MODULE_NOT_FOUND is claimed.
Supported package/runtime composition must be resolved and independently tested
before consumer acceptance.
It must never download a same-named registry replacement or fall back to a checkout.

The consumer authoring is excluded from the accepted child checkpoint while that
configuration investigation proceeds. The production SDK exports, parent retained
realizations, deployments and retained-wrapper authority remain unchanged. Closing
#442 still requires supported importer qualification, compatibility cutover, complete
application duplication analysis, deployment parity and wrapper-retirement evidence.
