[Patina API reference](../../../../README.md) / [@patina-ui/server/followups](../README.md) / markdownToAdf

# Function: markdownToAdf()

> **markdownToAdf**(`md`): [`AdfDoc`](../interfaces/AdfDoc.md)

The small markdown subset follow-ups use (paragraphs, `> ` quotes, `- ` lists, **bold**,
`code`) as Atlassian Document Format. Everything else is plain text; HTML tags are removed.

## Parameters

### md

`string`

## Returns

[`AdfDoc`](../interfaces/AdfDoc.md)
