using System.Security.Cryptography;
using System.Text;
using Brepia.Grasshopper.Components;
using Brepia.Grasshopper.Runtime;
using GH_IO.Serialization;
using Grasshopper.Kernel;

namespace Brepia.Grasshopper.Packaging;

public sealed record BrepiaGrasshopperPackageResult(
    string OutputPath,
    long ByteLength,
    string ProjectId,
    string SourceRevisionId,
    Guid ComponentInstanceId);

public static class BrepiaGrasshopperDocumentPackager
{
    private const string DefinitionArchiveName = "Definition";

    public static BrepiaGrasshopperPackageResult Write(
        string contractJson,
        string outputPath)
    {
        var contract = BrepiaGrasshopperContract.Parse(contractJson);
        var fullOutputPath = Path.GetFullPath(outputPath);
        if (!string.Equals(
                Path.GetExtension(fullOutputPath),
                GH_Archive.GrasshopperBinaryExtension,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException(
                $"Grasshopper package output must use the {GH_Archive.GrasshopperBinaryExtension} extension.");
        }

        var directory = Path.GetDirectoryName(fullOutputPath);
        if (string.IsNullOrWhiteSpace(directory))
        {
            throw new InvalidDataException("Grasshopper package output directory is invalid.");
        }
        Directory.CreateDirectory(directory);

        var component = new BrepiaProjectComponent();
        component.LoadContractJson(contract.NormalizedJson);
        var componentInstanceId = StableGuid(
            contract.ProjectId,
            contract.SourceRevisionId,
            "brepia-project-component");
        component.NewInstanceGuid(componentInstanceId);

        var document = new GH_Document();
        if (!document.AddObject(component, update: false))
        {
            throw new InvalidDataException("Could not add the Brepia component to the Grasshopper document.");
        }

        var archive = new GH_Archive();
        if (!archive.AppendObject(document, DefinitionArchiveName))
        {
            throw new InvalidDataException("Could not serialize the Grasshopper document archive.");
        }
        if (!archive.WriteToFile(fullOutputPath, overwrite: true, rememberPath: false))
        {
            throw new IOException("Could not write the Grasshopper document archive.");
        }

        ValidateArchive(fullOutputPath, contract, componentInstanceId);

        var fileInfo = new FileInfo(fullOutputPath);
        if (!fileInfo.Exists || fileInfo.Length <= 0)
        {
            throw new IOException("Grasshopper document archive is empty after serialization.");
        }

        return new BrepiaGrasshopperPackageResult(
            fullOutputPath,
            fileInfo.Length,
            contract.ProjectId,
            contract.SourceRevisionId,
            componentInstanceId);
    }

    private static void ValidateArchive(
        string path,
        BrepiaGrasshopperContract contract,
        Guid componentInstanceId)
    {
        var archive = new GH_Archive();
        if (!archive.ReadFromFile(path))
        {
            throw new InvalidDataException("Grasshopper archive could not be read back after serialization.");
        }

        var xml = archive.Serialize_Xml();
        if (!xml.Contains("brepia.contract.v1", StringComparison.Ordinal) ||
            !xml.Contains(contract.ProjectId, StringComparison.Ordinal) ||
            !xml.Contains(contract.SourceRevisionId, StringComparison.Ordinal) ||
            !xml.Contains(componentInstanceId.ToString("D"), StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException(
                "Grasshopper archive read-back is missing Brepia contract or identity data.");
        }
    }

    private static Guid StableGuid(
        string projectId,
        string sourceRevisionId,
        string role)
    {
        var bytes = SHA256.HashData(
            Encoding.UTF8.GetBytes($"brepia-gh-v1\n{projectId}\n{sourceRevisionId}\n{role}"));
        return new Guid(bytes.AsSpan(0, 16));
    }
}
