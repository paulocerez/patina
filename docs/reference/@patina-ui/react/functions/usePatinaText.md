[Patina API reference](../../../README.md) / [@patina-ui/react](../README.md) / usePatinaText

# Function: usePatinaText()

> **usePatinaText**(): `object`

The provider's locale and Patina's own texts in it, for your components and generated
blocks: `const { locale, t } = usePatinaText(); t("loading")`.

## Returns

`object`

### locale

> **locale**: `string`

### t

> **t**: (`key`, `params?`) => `string`

#### Parameters

##### key

`"default"` \| `"data"` \| `"move"` \| `"remove"` \| `"hide"` \| `"reset"` \| `"malformedOp"` \| `"notApplied"` \| `"unknownNode"` \| `"propNotCustomizable"` \| `"propNotReplaceable"` \| `"noSuchSetting"` \| `"noItems"` \| `"noSuchItem"` \| `"keyFixed"` \| `"notHideable"` \| `"hiddenOnOff"` \| `"fieldInvalid"` \| `"propInvalid"` \| `"queryInvalid"` \| `"newQueryInvalid"` \| `"noOrder"` \| `"orderFixed"` \| `"cantPlace"` \| `"cantAdd"` \| `"youCanAdd"` \| `"cantGoIn"` \| `"newKeyPrefix"` \| `"duplicateKey"` \| `"presetNoSetting"` \| `"onlyHide"` \| `"baseNotRemovable"` \| `"mustBeOneOf"` \| `"mustBeWholeNumber"` \| `"mustBeOnOff"` \| `"mustBeText"` \| `"atMostChars"` \| `"disallowedChars"` \| `"mustSortBy"` \| `"wrongShape"` \| `"unknownField"` \| `"missingField"` \| `"notReplaceable"` \| `"or"` \| `"on"` \| `"off"` \| `"ascending"` \| `"descending"` \| `"yes"` \| `"no"` \| `"queryMustDescribe"` \| `"queryCantUse"` \| `"queryOnlyFrom"` \| `"queryNoData"` \| `"queryFieldUnavailable"` \| `"queryFieldWrongWay"` \| `"queryMaxFilters"` \| `"queryBadFilter"` \| `"queryCantFilter"` \| `"queryFieldCount"` \| `"queryFieldTwice"` \| `"queryBadSort"` \| `"querySortDir"` \| `"queryMaxRows"` \| `"queryNotComplete"` \| `"queryMetricOneOf"` \| `"queryCountRows"` \| `"queryNeedsNumber"` \| `"queryNeedsGroup"` \| `"queryDateBucket"` \| `"queryBadGroup"` \| `"queryCantGroup"` \| `"queryOnlyDatesBucket"` \| `"opCount"` \| `"opSum"` \| `"opSumOf"` \| `"opAvg"` \| `"opMin"` \| `"opMax"` \| `"by"` \| `"where"` \| `"is"` \| `"and"` \| `"bucketDay"` \| `"bucketWeek"` \| `"bucketMonth"` \| `"setProp"` \| `"setField"` \| `"inName"` \| `"show"` \| `"add"` \| `"toStart"` \| `"toEnd"` \| `"before"` \| `"after"` \| `"unreadableFormat"` \| `"refusalFallback"` \| `"clarifyFallback"` \| `"typeSomething"` \| `"promptTooLong"` \| `"rateLimited"` \| `"quotaUser"` \| `"quotaTenant"` \| `"modelUnavailable"` \| `"nothingToChange"` \| `"notPossible"` \| `"safetyDecline"` \| `"previewGone"` \| `"viewChanged"` \| `"customizeOff"` \| `"dataViewsOff"` \| `"somethingWrong"` \| `"promptLabel"` \| `"promptPlaceholder"` \| `"preview"` \| `"thinking"` \| `"apply"` \| `"discard"` \| `"proposedChanges"` \| `"undo"` \| `"skippedOne"` \| `"skippedMany"` \| `"shipped"` \| `"dismiss"` \| `"notConfigured"` \| `"capReorder"` \| `"capHide"` \| `"capArrange"` \| `"capAdd"` \| `"capSet"` \| `"capData"` \| `"capHintData"` \| `"capHintArrange"` \| `"capHintSet"` \| `"capHintAddData"` \| `"capHintPage"` \| `"capTitle"` \| `"exMoveTop"` \| `"exHide"` \| `"exSet"` \| `"exChart"` \| `"exTable"` \| `"loadError"` \| `"blockTable"` \| `"blockChart"` \| `"blockStat"` \| `"chartType"` \| `"loading"` \| `"unavailable"` \| `"nothingToShow"`

##### params?

`Record`\<`string`, `string` \| `number`\>

#### Returns

`string`
