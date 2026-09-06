using GH_IO;
using GH_IO.Serialization;

if (args.Length != 1)
{
    Console.Error.WriteLine("Usage: Brepia.GhIoProbe <output.gh>");
    return 2;
}

var outputPath = Path.GetFullPath(args[0]);
var expected = new ProbePayload("cabinetA42", "revision-42");
var archive = new GH_Archive();
if (!archive.AppendObject(expected, "BrepiaProbe"))
{
    Console.Error.WriteLine("Could not append GH_IO probe payload.");
    return 1;
}

// Avoid GH_Archive.WriteToFile/ReadFromFile here. Those convenience methods
// pull in desktop UI assemblies even though GH_IO's binary archive codec itself
// is sufficient for deterministic headless serialization.
var binary = archive.Serialize_Binary();
if (binary.Length == 0)
{
    Console.Error.WriteLine("GH_IO produced an empty binary archive.");
    return 1;
}
File.WriteAllBytes(outputPath, binary);

var persisted = File.ReadAllBytes(outputPath);
var readBack = new GH_Archive();
if (!readBack.Deserialize_Binary(persisted))
{
    Console.Error.WriteLine("Could not deserialize GH_IO probe archive.");
    return 1;
}
var actual = new ProbePayload();
if (!readBack.ExtractObject(actual, "BrepiaProbe") ||
    actual.ProjectId != expected.ProjectId ||
    actual.SourceRevisionId != expected.SourceRevisionId)
{
    Console.Error.WriteLine("GH_IO probe archive identity did not round-trip.");
    return 1;
}

Console.WriteLine(
    $"GH_IO standalone round-trip PASS: {actual.ProjectId} {actual.SourceRevisionId} {persisted.Length} bytes");
return 0;

sealed class ProbePayload : GH_ISerializable
{
    public ProbePayload()
    {
    }

    public ProbePayload(string projectId, string sourceRevisionId)
    {
        ProjectId = projectId;
        SourceRevisionId = sourceRevisionId;
    }

    public string ProjectId { get; private set; } = string.Empty;
    public string SourceRevisionId { get; private set; } = string.Empty;

    public bool Write(GH_IWriter writer)
    {
        writer.SetString("projectId", ProjectId);
        writer.SetString("sourceRevisionId", SourceRevisionId);
        return true;
    }

    public bool Read(GH_IReader reader)
    {
        ProjectId = reader.GetString("projectId");
        SourceRevisionId = reader.GetString("sourceRevisionId");
        return true;
    }
}
