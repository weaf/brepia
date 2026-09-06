using System.Buffers.Binary;
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
    private const string InstanceGuidNamespace = "brepia-grasshopper-package-plan-v1";

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
        var componentInstanceId = StableGuid(contract.ProjectId, "brepia-project");
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

        // Avoid GH_Archive.WriteToFile/ReadFromFile. Those convenience APIs pull
        // desktop UI dependencies; the archive codec plus ordinary file I/O is
        // a narrower cross-platform Rhino-hosted boundary.
        var binary = archive.Serialize_Binary();
        if (binary.Length == 0)
        {
            throw new IOException("Grasshopper document archive serialized to zero bytes.");
        }
        File.WriteAllBytes(fullOutputPath, binary);

        ValidateArchive(binary, contract, componentInstanceId);

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
        byte[] binary,
        BrepiaGrasshopperContract contract,
        Guid componentInstanceId)
    {
        var archive = new GH_Archive();
        if (!archive.Deserialize_Binary(binary))
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

    private static Guid StableGuid(params string[] parts)
    {
        var segments = new[] { InstanceGuidNamespace }
            .Concat(parts)
            .Select(Encoding.UTF8.GetBytes)
            .ToArray();
        var input = new byte[segments.Sum(segment => 4 + segment.Length)];
        var offset = 0;
        foreach (var segment in segments)
        {
            BinaryPrimitives.WriteUInt32BigEndian(
                input.AsSpan(offset, 4),
                checked((uint)segment.Length));
            offset += 4;
            segment.CopyTo(input, offset);
            offset += segment.Length;
        }

        var hash = SHA256.HashData(input);
        hash[6] = (byte)((hash[6] & 0x0f) | 0x80);
        hash[8] = (byte)((hash[8] & 0x3f) | 0x80);
        var hex = Convert.ToHexString(hash.AsSpan(0, 16)).ToLowerInvariant();
        return Guid.ParseExact(
            $"{hex[..8]}-{hex[8..12]}-{hex[12..16]}-{hex[16..20]}-{hex[20..32]}",
            "D");
    }
}
