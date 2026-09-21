# Broken deployment fixture

This scenario is encoded in `reprise demo acquisition`: v1.7 is verified as compatible; v1.8 applies M039 and deploys `api-users@902a`, which expects an incompatible data shape. The local demo reconstructs v1.7 and verifies the candidate without contacting a provider.
